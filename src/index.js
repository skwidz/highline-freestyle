import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap/dist/js/bootstrap.js'
import $ from 'jquery'
import Popper from 'popper.js';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import registerServiceWorker from './serviceWorkerRegistration';
import './index.css';


ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

registerServiceWorker();
