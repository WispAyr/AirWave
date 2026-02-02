module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    // Adjust rules for project style
    'no-console': 'off', // Allow console for logging
    'class-methods-use-this': 'off', // Allow instance methods
    'no-underscore-dangle': 'off', // Allow private properties
    'max-len': ['error', { code: 120, ignoreComments: true, ignoreStrings: true }],
    'no-param-reassign': ['error', { props: false }],
    'consistent-return': 'off', // Allow implicit returns
    'no-use-before-define': ['error', { functions: false, classes: true }],
    'prefer-destructuring': 'off', // Allow non-destructured assignments
    'no-plusplus': 'off', // Allow ++ operator
    'no-continue': 'off', // Allow continue statement
    'no-await-in-loop': 'off', // Allow await in loops when necessary
    'import/no-dynamic-require': 'off', // Allow dynamic requires
    'global-require': 'off', // Allow require() anywhere
  },
};

