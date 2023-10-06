const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const conn = require("../db/conn");
const pool = require("../db/conn");
const router = express.Router();
const { Configuration, OpenAIApi } = require("openai");

const config = new Configuration({
  apiKey: "KEY_IS NECESSARY TO RUN THIS CODE",
});

const openai = new OpenAIApi(config);

const app = express();
app.use(bodyParser.json());
app.use(cors());

router.post("/chat", async (req, res) => {
  console.log("Entering into chatbot");
  const { prompt } = req.body;
  // const promptString = prompt.toString();

  console.log("prompt: ", prompt);
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that provides information about medical procedures.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });
    res.send(completion.data.choices[0].message.content);
  } catch (error) {
    console.error("Error for chatbot:", error);
    res.status(500).send("An error occured.");
  }
  console.log("exiting from chatbot");
});

module.exports = router;
