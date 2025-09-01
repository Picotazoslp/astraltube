module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        chrome: '88'
      },
      modules: process.env.NODE_ENV === 'test' ? 'commonjs' : false
    }]
  ],
  plugins: [
    '@babel/plugin-transform-optional-chaining',
    '@babel/plugin-transform-nullish-coalescing-operator'
  ],
  env: {
    test: {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          },
          modules: 'commonjs'
        }]
      ]
    }
  }
};