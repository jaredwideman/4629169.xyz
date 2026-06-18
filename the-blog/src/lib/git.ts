import simpleGit, { SimpleGit } from "simple-git";
import { contentDir } from "./posts";

export function gitEnabled() {
  return Boolean(process.env.BLOG_GIT_PAT);
}

function git(): SimpleGit {
  return simpleGit(contentDir());
}

function authenticatedRemoteUrl(url: string): string {
  const pat = process.env.BLOG_GIT_PAT;
  if (!pat) return url;
  // Convert git@github.com:owner/repo.git -> https with PAT
  const ssh = url.match(/^git@github\.com:(.+)$/);
  if (ssh) return `https://x-access-token:${pat}@github.com/${ssh[1]}`;
  // Inject PAT into https URL
  const https = url.match(/^https:\/\/(?:[^@/]+@)?github\.com\/(.+)$/);
  if (https) return `https://x-access-token:${pat}@github.com/${https[1]}`;
  return url;
}

/**
 * Commit + push the given files. Best-effort: errors are returned, not thrown,
 * so the editor still saves to disk even if push fails.
 */
export async function commitAndPush(message: string, files: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!gitEnabled()) return { ok: false, error: "git push disabled (no BLOG_GIT_PAT)" };
  const g = git();
  const branch = process.env.GIT_BRANCH || "main";
  const remote = process.env.GIT_REMOTE || "origin";
  const authorName = process.env.GIT_AUTHOR_NAME || "Blog Bot";
  const authorEmail = process.env.GIT_AUTHOR_EMAIL || "blog-bot@4629169.xyz";
  try {
    await g.addConfig("user.name", authorName);
    await g.addConfig("user.email", authorEmail);

    // Configure auth for the remote without persisting the PAT in .git/config:
    const remotes = await g.getRemotes(true);
    const found = remotes.find((r) => r.name === remote);
    if (!found) return { ok: false, error: `remote ${remote} not configured` };
    const authedUrl = authenticatedRemoteUrl(found.refs.fetch);

    // Pull latest with rebase to avoid conflicts. The editor saves the markdown
    // file before calling us, so the working tree may already be dirty; stash it
    // temporarily so rebase can run, then restore and commit the saved changes.
    const preStatus = await g.status();
    const hadLocalChanges =
      preStatus.files.length > 0 || preStatus.created.length > 0 || preStatus.deleted.length > 0;
    if (hadLocalChanges) {
      await g.raw(["stash", "push", "--include-untracked", "--message", "blog-editor-publish"]);
    }

    await g.fetch(authedUrl, branch);
    await g.raw(["rebase", `FETCH_HEAD`]);

    if (hadLocalChanges) {
      await g.raw(["stash", "pop"]);
    }

    await g.add(files);
    const status = await g.status();
    if (status.staged.length === 0 && status.modified.length === 0 && status.deleted.length === 0) {
      return { ok: true }; // nothing to commit
    }
    await g.commit(message);
    await g.push(authedUrl, branch);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
