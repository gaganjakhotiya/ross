const express = require("express");
const app = express();
require('dotenv').config();

const port = process.env.PORT || 3000;
const slackRoss = require('./src/controllers/slackRoss');

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello from Ross!");
});

app.get("/slack/ross/command", slackRoss.command);

app.listen(port, () => {
  console.log(`Ross server is running on http://localhost:${port}`);
});
