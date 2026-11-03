const { checkSecurity, getClientIp } = require('./_security');

module.exports = async function handler(req, res) {
  // CORS configuration
  const reqOrigin = req.headers.origin || '';
  const isAllowedOrigin = (orig) => {
    if (!orig) return true;
    if (orig.includes('localhost') || orig.includes('127.0.0.1')) return true;
    if (orig.endsWith('.vercel.app')) return true;
    if (orig.includes('hitechmobiles') || orig.includes('hitech')) return true;
    return false;
  };

  const allowedOrigin = isAllowedOrigin(reqOrigin) && reqOrigin ? reqOrigin : '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  if (allowedOrigin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, X-HiTech-Client, X-Admin-Token'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Security check with 2MB payload allowance and attack pattern skip for catalog JSON
  const sec = checkSecurity(req, res, {
    maxPayloadSize: 2 * 1024 * 1024,
    skipAttackInspection: true,
    maxRequestsPerWindow: 30
  });
  if (!sec.allowed) {
    return res.status(sec.status).json({ error: sec.error });
  }

  const repoOwner = process.env.GITHUB_OWNER || 'hitechmobiles';
  const repoName = process.env.GITHUB_REPO || 'HiTech';

  // GET handler for health & verification check
  if (req.method === 'GET') {
    const queryToken = req.query?.token;
    const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const token = queryToken || authHeader || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

    if (!token) {
      return res.status(200).json({
        configured: false,
        message: 'No GitHub PAT configured in server environment or request.'
      });
    }

    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'HiTech-Serverless-Publish'
        }
      });

      if (!userRes.ok) {
        return res.status(200).json({
          configured: false,
          error: 'GitHub token verification returned 401 Bad credentials'
        });
      }

      const userData = await userRes.json();
      return res.status(200).json({
        configured: true,
        user: userData.login,
        owner: repoOwner,
        repo: repoName,
        message: `Connected successfully to GitHub as @${userData.login}`
      });
    } catch (err) {
      return res.status(500).json({
        configured: false,
        error: err?.message || 'Verification connection failed'
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET or POST.' });
  }

  const { files, commitMessage, branch, reason, clientToken } = req.body || {};

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Missing files array in request body.' });
  }

  const targetBranch = branch || process.env.GITHUB_BRANCH || 'develop';
  const effectiveToken = clientToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

  if (!effectiveToken) {
    return res.status(401).json({
      success: false,
      error: 'GitHub Personal Access Token is missing. Please configure GITHUB_TOKEN in Vercel or provide a PAT in Admin Settings.'
    });
  }

  const ghHeaders = {
    'Authorization': `Bearer ${effectiveToken}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'HiTech-Serverless-Publish',
    'Content-Type': 'application/json'
  };

  try {
    const committedFiles = [];

    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') {
        continue;
      }

      const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${file.path}`;

      // 1. Fetch existing file SHA if present
      let sha;
      try {
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(targetBranch)}`, {
          headers: ghHeaders
        });
        if (getRes.ok) {
          const existing = await getRes.json();
          sha = existing.sha;
        }
      } catch (e) {
        sha = undefined;
      }

      // 2. Put file to branch
      const base64Content = Buffer.from(file.content, 'utf8').toString('base64');
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: ghHeaders,
        body: JSON.stringify({
          message: commitMessage || `feat(catalog): sync ${file.path} from Admin Console`,
          content: base64Content,
          branch: targetBranch,
          sha
        })
      });

      if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(`Failed to commit ${file.path}: ${errData.message || putRes.statusText}`);
      }

      committedFiles.push(file.path);
    }

    // 3. Trigger immediate GitHub Actions workflow dispatch if available
    let pipelineDispatched = false;
    let pipelineMessage = '';
    try {
      const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/admin-publish-immediate.yml/dispatches`;
      const dispatchRes = await fetch(dispatchUrl, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({
          ref: targetBranch,
          inputs: {
            trigger_reason: reason || 'Admin Catalog Publish',
            actor_email: 'admin'
          }
        })
      });
      if (dispatchRes.ok) {
        pipelineDispatched = true;
        pipelineMessage = 'Workflow admin-publish-immediate.yml dispatched successfully';
      }
    } catch (dispErr) {
      pipelineMessage = dispErr?.message || 'Workflow dispatch skipped';
    }

    return res.status(200).json({
      success: true,
      message: `Successfully committed ${committedFiles.length} catalog files to ${repoOwner}/${repoName}@${targetBranch}!`,
      committedFiles,
      branch: targetBranch,
      pipelineDispatched,
      pipelineMessage
    });

  } catch (err) {
    console.error('Error during catalog publish:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while publishing catalog'
    });
  }
};
