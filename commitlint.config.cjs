const ERROR = 2;

module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// Rules repeated from @commitlint/config-conventional are pinned here on
		// purpose, so a future version of that package cannot change what we
		// accept without us noticing.
		'header-max-length': [ERROR, 'always', 100],
		'type-enum': [
			ERROR,
			'always',
			[
				'feat',
				'fix',
				'docs',
				'style',
				'refactor',
				'perf',
				'test',
				'build',
				'ci',
				'chore',
				'revert',
			],
		],
		// Reject the "!" breaking-change shorthand, e.g. "feat!: remove X".
		// Our semantic-release setup does not understand it, so the commit would
		// not trigger a release. Write a "BREAKING CHANGE: ..." line in the commit
		// body instead; that triggers a major release.
		'subject-exclamation-mark': [ERROR, 'never'],
	},
};
