const fs = require("fs");
const qrcode = require("qrcode-terminal");
const {
  Client,
  MessageMedia,
  LocalAuth,
  PhoneNumber,
} = require("whatsapp-web.js");
const axios = require("axios");
const FormData = require("form-data");
const ffmpeg = require("fluent-ffmpeg");
const ProgressBar = require("progress");
const { transcribeAudio } = require("./speech_to_text");
require("dotenv").config();

const natural = require("natural");
const { send } = require("process");

async function sendData(filePath) {
  const axios = require("axios");
  const FormData = require("form-data");
  const fs = require("fs");
  let data = new FormData();
  data.append("", fs.createReadStream(filePath));

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "http://8.211.32.217:5000/upload",
    headers: {
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjp7InVzZXJfaWQiOjEyMywidXNlcm5hbWUiOiJqb2huX2RvZSJ9LCJleHAiOjE3MjM2MTI0Nzl9.z4MBKlGw1H7P0j83_YNgWQE8wOhmCMnGn3HrL3xXDOM",
      ...data.getHeaders(),
    },
    data: data,
  };

  axios
    .request(config)
    .then((response) => {
      console.log(JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });
}
const list_file = [
  "C:/Users/Admin/Downloads/inteview_prep_guide.pdf",
  "C:/Users/Admin/Downloads/Template_InterviewGuide.pdf",
  "C:/Users/Admin/Downloads/interview_guide_5.pdf",
  "C:/Users/Admin/Downloads/Preparing-for-an-Interview.pdf",
  "C:/Users/Admin/Downloads/guide_interview.pdf",
  "C:/Users/Admin/Downloads/interview-faq.pdf",
  "C:/Users/Admin/Downloads/18220107.pdf",
  "C:/Users/Admin/Downloads/Interview-guide-web.pdf",
  "C:/Users/Admin/Downloads/Effective-Job-Interviewing-for-Applicants-Participant-Guide.pdf",
];

list_file.forEach((element) => {
  sendData(element);
});
async function getAnswerFromAlibaba(text) {
  const data = JSON.stringify({ query: text });

  const config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "http://8.211.32.217:5000/query",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXlsb2FkIjp7InVzZXJfaWQiOjEyMywidXNlcm5hbWUiOiJqb2huX2RvZSJ9LCJleHAiOjE3MjM2MTI0Nzl9.z4MBKlGw1H7P0j83_YNgWQE8wOhmCMnGn3HrL3xXDOM",
    },
    data: data,
  };

  try {
    const response = await axios.request(config);
    // console.log(response);
    return JSON.stringify(response.data.answer);
  } catch (error) {
    console.log("Error:", error);
    return null;
  }
}

async function getBetterAnswer(text) {
  const messages = [
    {
      role: "system",
      content:
        "Your task is to improve the text provided, format it, it shouldn't be too long",
    },
    {
      role: "user",
      content: text,
    },
  ];

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 2000,
        n: 1,
        stop: null,
        temperature: 0.5,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    // Check if the response has the 'choices' property and at least one choice
    if (
      response &&
      response.data &&
      response.data.choices &&
      response.data.choices.length > 0
    ) {
      return response.data.choices[0].message.content;
    } else {
      console.error(
        "Error: Unexpected response format from OpenAI API. Status:",
        response.status,
        "Data:",
        response.data
      );
      return "";
    }
  } catch (error) {
    console.error("Error during summary and action steps generation:", error);
    return "";
  }
}

const client = new Client({
  // authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

async function convertAudio(inputFilename, outputFilename) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilename)
      .output(outputFilename)
      .on("end", () => resolve())
      .on("error", (error) => reject(error))
      .run();
  });
}

client.on("message", async (msg) => {
  // msg.reply("hi");
  if (msg.hasMedia && (msg.type === "ptt" || msg.isForwarded)) {
    console.log("Voice note received.");
    const media = await msg.downloadMedia();
    const oggBuffer = Buffer.from(media.data, "base64");
    const oggFilename = `${msg.id.id}.ogg`;
    fs.writeFileSync(oggFilename, oggBuffer);
    console.log("Converting voice note to M4A...");
    const m4aFilename = `${msg.id.id}.m4a`;
    try {
      await convertAudio(oggFilename, m4aFilename);
      console.log("Voice note converted.");

      console.log("Transcribing voice note...");
      const transcription = await transcribeAudio(m4aFilename);
      console.log("Voice note transcribed.");

      const outputText = transcription.paragraphs.join("\n\n");

      console.log("Output text:", outputText); // Debugging statement

      if (outputText) {
        const summaryAndActionSteps = await getAnswerFromAlibaba(outputText);
        const betterAnswer = await getBetterAnswer(summaryAndActionSteps);
        const senderNumberId = msg.from;
        if (senderNumberId) {
          // Add sender's information and the time the message was sent to the transcription output
          const contact = await msg.getContact();
          const senderInfo = `*Sender:* ${contact.pushname || "Unknown"} (${
            msg.from
          })\n*Time:* ${new Date(msg.timestamp * 1000).toLocaleString()}\n\n`;
          const fullMessage = `${betterAnswer} \n`;

          await client.sendMessage(senderNumberId, fullMessage);
          console.log("Transcription sent.");
        } else {
          console.log("Error: Failed to get sender number ID.");
        }
      } else {
        console.log("Error: Failed to process voice note.");
      }
    } catch (error) {
      console.log("Error:", error);
    } finally {
      fs.unlinkSync(oggFilename);
      fs.unlinkSync(m4aFilename);
    }
  } else {
    const senderNumberId = msg.from;
    const summaryAndActionSteps = await getAnswerFromAlibaba(msg.body);
    const betterAnswer = await getBetterAnswer(summaryAndActionSteps);

    const fullMessage = `${betterAnswer} \n`;

    await client.sendMessage(senderNumberId, fullMessage);

    console.log("message sent.");
  }
});

client.on("error", (error) => {
  console.error("Error:", error);
});

client.initialize();
