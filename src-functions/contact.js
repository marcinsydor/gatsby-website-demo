require("dotenv").config({
  path: `.env.${process.env.NODE_ENV}`
});

const mailgun = require("mailgun-js");
const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
  host: process.env.MAILGUN_HOST
});

const successCode = 200;
const errorCode = 400;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type"
};

exports.handler = function(event, context, callback) {
  console.log("key", process.env.MAILGUN_API_KEY);
  console.log("domain", process.env.MAILGUN_DOMAIN);
  console.log("host", process.env.MAILGUN_HOST);
  console.log("admin", process.env.ADMIN_EMAIL);

  let data = JSON.parse(event.body);
  let { name, email, subject, message } = data;
  let mailOptions = {
    from: `${name} <${email}>`,
    to: process.env.ADMIN_EMAIL,
    replyTo: email,
    subject: subject,
    text: message
  };

  console.log(`mailOptions: ${JSON.stringify(mailOptions)}`);

  mg.messages().send(mailOptions, (error, body) => {
    if (error) {
      console.log(`error: ${error}`);
      callback(null, {
        statusCode: errorCode,
        headers,
        body: JSON.stringify(error)
      });
    } else {
      console.log(`body: ${body}`);
      callback(null, {
        statusCode: successCode,
        headers,
        body: JSON.stringify(body)
      });
    }
  });
};
