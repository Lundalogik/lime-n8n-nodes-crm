const ERROR = 2;

module.exports = {
	extends: ['@commitlint/config-conventional'],
	rules: {
		'header-max-length': [ERROR, 'always', 100],
		// Spelled out so a type that semantic-release does not recognise is
		// caught in review instead of silently skipping a release.
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
	},
};
