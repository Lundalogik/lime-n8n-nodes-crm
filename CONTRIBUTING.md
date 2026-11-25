# Contributing

Thanks for helping improve the Lime CRM nodes for n8n. Pull requests are welcome.

## Before you start

For anything bigger than a small fix, open an issue first and describe what you want to change. That way we can agree on the approach before you spend time on it.

## Development setup

Fork the repository, clone your fork and add this repository as the `upstream` remote. Use Node.js 24, the version CI uses.

```bash
git remote add upstream https://github.com/Lundalogik/lime-n8n-nodes-crm.git
npm ci
npm run dev     # run n8n locally with the node loaded
npm run build   # compile to dist/
npm test        # jest unit tests
npm run lint    # n8n community node lint rules (npm run lint:fix to fix)
npm run format  # prettier check (npm run format:fix to fix)
npm run knip    # dead code check
```

CI runs the build, tests, lint, format and knip checks on every pull request, together with the commit message checks below. Run them locally before you push.

## Your change

- Add tests for the cases your change introduces.
- Update the README if you add a feature or change how one works.

## Commit messages

Every commit lands on `main` as you wrote it. [semantic-release](https://github.com/semantic-release/semantic-release) builds the version number and the changelog from the commit messages, and CI checks them with [commitlint](https://commitlint.js.org/) using the [conventional config](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional).

- Follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <subject>`, for example `fix(trigger): handle an empty webhook payload`.
- Use one of these types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` or `revert`.
- A `feat` commit triggers a minor release, and a `fix` or `perf` commit triggers a patch release. The other types don't publish a release.
- To undo a commit, use `git revert` and keep the message it generates. That triggers a patch release.
- For a breaking change, add a `BREAKING CHANGE: ...` footer to the commit. It triggers a major release. Don't use the `feat!:` shorthand; commitlint rejects it.
- Make each commit one self-contained change.

## Pull requests

- CI fails if the pull request contains `fixup!`, `squash!` or `amend!` commits. Run `git fetch upstream` and `git rebase -i --autosquash upstream/main`, then force-push before asking for a review.
- To bring your branch up to date, run `git fetch upstream` and rebase it onto `upstream/main`. Don't merge `main` into your branch.
- If you contribute from a fork, CI only runs after a maintainer approves it.
- Allow [edits from maintainers](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/allowing-changes-to-a-pull-request-branch-created-from-a-fork), so we can rebase your branch or make small fixes.
