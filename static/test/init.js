const mochaWrapper = document.getElementById('mocha');
const invokeMochaButton = document.getElementById('invoke-mocha-button');


invokeMochaButton.addEventListener('click', () => {
  mochaWrapper.classList.toggle('active');
});

mocha.setup({
  ui: 'bdd',
  timeout: 100,
  // allowUncaught: true,
});
