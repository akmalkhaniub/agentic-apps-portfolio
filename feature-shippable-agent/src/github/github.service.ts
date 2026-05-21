import { Injectable } from '@nestjs/common';
import { Octokit } from 'octokit';

@Injectable()
export class GithubService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async cloneRepo(owner: string, repo: string) {
    // Note: In E2B, we would use git clone with the token
    const repoUrl = `https://${process.env.GITHUB_TOKEN}@github.com/${owner}/${repo}.git`;
    return repoUrl;
  }

  async createPullRequest(owner: string, repo: string, title: string, body: string, head: string, base: string = 'main') {
    const response = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return response.data;
  }

  async getFileContent(owner: string, repo: string, path: string) {
    const response = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    // @ts-ignore
    return Buffer.from(response.data.content, 'base64').toString();
  }
}
