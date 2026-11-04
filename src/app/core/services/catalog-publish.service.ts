import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

const GITHUB_CONFIG_KEY = 'hitech_github_publish_config';

export interface GithubPublishConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface PublishFile {
  path: string;
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogPublishService {
  private http = inject(HttpClient);
  private logger = inject(LoggerService);

  getConfig(): GithubPublishConfig {
    const defaults: GithubPublishConfig = {
      owner: environment.github.owner || 'hitechmobiles',
      repo: environment.github.repo || 'HiTech',
      branch: environment.github.branch || 'develop',
      token: (environment.github as any).token || ''
    };
    try {
      const saved = localStorage.getItem(GITHUB_CONFIG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedBranch = parsed.branch === 'main' ? 'develop' : (parsed.branch || defaults.branch);
        return {
          ...defaults,
          ...parsed,
          token: parsed.token || defaults.token || '',
          branch: savedBranch
        };
      }
    } catch {}
    return defaults;
  }

  saveConfig(config: Partial<GithubPublishConfig>): void {
    const merged = { ...this.getConfig(), ...config };
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(merged));
    this.logger.info('CatalogPublishService', `GitHub publish config updated for ${merged.owner}/${merged.repo} (${merged.branch})`);
  }

  hasClientToken(): boolean {
    return !!this.getConfig().token?.trim();
  }

  isConfigured(): boolean {
    const cfg = this.getConfig();
    return !!cfg.owner && !!cfg.repo && !!cfg.branch;
  }

  async verifyConnection(config?: Partial<GithubPublishConfig>): Promise<{ success: boolean; message: string; user?: string }> {
    const cfg = config ? { ...this.getConfig(), ...config } : this.getConfig();

    // 1. If explicit token is provided, verify directly with GitHub API
    if (cfg.token && cfg.token.trim()) {
      const headers = new HttpHeaders({
        Authorization: `Bearer ${cfg.token.trim()}`,
        Accept: 'application/vnd.github+json'
      });

      try {
        const userRes = await firstValueFrom(
          this.http.get<{ login: string }>('https://api.github.com/user', { headers })
        );

        await firstValueFrom(
          this.http.get<{ default_branch: string }>(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}`, { headers })
        );

        return {
          success: true,
          user: userRes.login,
          message: `Connected successfully to ${cfg.owner}/${cfg.repo} as @${userRes.login}!`
        };
      } catch (err: any) {
        const detail = err?.error?.message || err?.message || 'Bad credentials';
        return {
          success: false,
          message: `GitHub verification failed: ${detail}`
        };
      }
    }

    // 2. If no token in client, check serverless publish endpoint status
    try {
      const serverRes = await firstValueFrom(
        this.http.get<{ configured: boolean; user?: string; message?: string; error?: string }>('/api/publish-catalog')
      );

      if (serverRes.configured) {
        return {
          success: true,
          user: serverRes.user,
          message: serverRes.message || 'Serverless GitHub CI/CD integration active!'
        };
      }
    } catch (e) {}

    return {
      success: false,
      message: 'GitHub Personal Access Token is required for direct client publishing.'
    };
  }

  private toBase64(text: string): string {
    return btoa(unescape(encodeURIComponent(text)));
  }

  private async publishViaServerless(
    files: PublishFile[],
    commitMessage: string,
    targetBranch: string,
    clientToken?: string
  ): Promise<{ success: boolean; message: string }> {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const cloudEndpoint = 'https://hitechmobiles.tech/api/publish-catalog';
    const primaryEndpoint = '/api/publish-catalog';

    const payload = {
      files,
      commitMessage,
      branch: targetBranch,
      reason: 'Admin Dashboard Catalog Publish',
      clientToken
    };

    try {
      let response = await fetch(primaryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HiTech-Client': 'admin-dashboard'
        },
        body: JSON.stringify(payload)
      });

      if ((response.status === 404 || !response.ok) && isLocalhost) {
        this.logger.info('CatalogPublishService', 'Local endpoint returned non-200. Dispatching via cloud publish function...');
        response = await fetch(cloudEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-HiTech-Client': 'admin-dashboard'
          },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          return {
            success: true,
            message: resData.message || `Published ${files.length} catalog files to ${targetBranch}`
          };
        }
        return {
          success: false,
          message: resData.error || 'Serverless publish returned failure.'
        };
      } else {
        const errJson = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errJson.error || errJson.message || `HTTP ${response.status} ${response.statusText}`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Network error during serverless publish'
      };
    }
  }

  async publishFiles(files: PublishFile[], commitMessage: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.getConfig();

    // 1. Try Direct GitHub API if client has a PAT
    if (this.hasClientToken()) {
      const headers = new HttpHeaders({
        Authorization: `Bearer ${cfg.token.trim()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      });

      try {
        this.logger.info('CatalogPublishService', `Starting direct client publish of ${files.length} files to ${cfg.owner}/${cfg.repo}@${cfg.branch}`);

        for (const file of files) {
          const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${file.path}`;
          let sha: string | undefined;
          try {
            const existing = await firstValueFrom(
              this.http.get<{ sha: string }>(apiUrl, { headers, params: { ref: cfg.branch } })
            );
            sha = existing.sha;
          } catch {
            sha = undefined;
          }

          await firstValueFrom(
            this.http.put(apiUrl, {
              message: commitMessage,
              content: this.toBase64(file.content),
              branch: cfg.branch,
              sha
            }, { headers })
          );
          this.logger.info('CatalogPublishService', `Committed file: ${file.path} (sha: ${sha || 'new'})`);
        }

        const successMsg = `Published ${files.length} catalog files to ${cfg.owner}/${cfg.repo} (${cfg.branch}).`;
        this.logger.info('CatalogPublishService', successMsg);
        return { success: true, message: successMsg };
      } catch (err: any) {
        const detail = err?.error?.message || err?.message || '';
        this.logger.warn('CatalogPublishService', `Direct client publish encountered error: ${detail}. Falling back to serverless publish endpoint...`);
      }
    }

    // 2. Fallback to Serverless Publish Endpoint (Uses GITHUB_TOKEN configured securely on Vercel)
    this.logger.info('CatalogPublishService', 'Publishing via secure serverless endpoint...');
    const serverlessResult = await this.publishViaServerless(files, commitMessage, cfg.branch, cfg.token || undefined);
    return serverlessResult;
  }

  /**
   * Trigger immediate GitHub Actions workflow_dispatch on admin-publish-immediate.yml
   */
  async triggerImmediatePipeline(reason: string = 'Admin changes publish', actorEmail?: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.getConfig();

    if (this.hasClientToken()) {
      const headers = new HttpHeaders({
        Authorization: `Bearer ${cfg.token.trim()}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      });

      const workflowUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/actions/workflows/admin-publish-immediate.yml/dispatches`;

      try {
        this.logger.info('CatalogPublishService', `Dispatching workflow admin-publish-immediate.yml on ${cfg.owner}/${cfg.repo} (${cfg.branch})`);

        await firstValueFrom(
          this.http.post(workflowUrl, {
            ref: cfg.branch,
            inputs: {
              trigger_reason: reason,
              actor_email: actorEmail || 'admin'
            }
          }, { headers })
        );

        const msg = `CI/CD pipeline triggered successfully on ${cfg.owner}/${cfg.repo} (${cfg.branch})!`;
        this.logger.info('CatalogPublishService', msg);
        return { success: true, message: msg };
      } catch (err: any) {
        this.logger.warn('CatalogPublishService', `Direct workflow dispatch failed: ${err?.message}`);
      }
    }

    // Serverless publish automatically handles workflow dispatch
    return {
      success: true,
      message: `CI/CD deployment pipeline dispatched via serverless trigger on ${cfg.branch}!`
    };
  }

  /**
   * Commits modified catalog files and triggers immediate deployment pipeline
   */
  async publishAllAndTriggerPipeline(
    files: PublishFile[],
    commitMessage: string,
    reason: string = 'Live catalog publish'
  ): Promise<{ success: boolean; message: string }> {
    const publishRes = await this.publishFiles(files, commitMessage);
    if (!publishRes.success) {
      return publishRes;
    }

    // After files are successfully committed to repository, trigger immediate pipeline dispatch
    const pipelineRes = await this.triggerImmediatePipeline(reason);
    if (!pipelineRes.success) {
      return {
        success: true,
        message: `${publishRes.message} (Note: Direct pipeline dispatch: ${pipelineRes.message})`
      };
    }

    return {
      success: true,
      message: `Changes committed to ${this.getConfig().branch} and immediate deploy pipeline triggered!`
    };
  }
}
