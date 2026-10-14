const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

//Rotas
const lojaRoutes = require('./routes/estoque');
app.use('/loja', lojaRoutes);

module.exports = app;
