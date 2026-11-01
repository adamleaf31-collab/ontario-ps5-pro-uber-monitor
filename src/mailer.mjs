import nodemailer from "nodemailer";

function transport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD are required");
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

export async function sendStockAlert(matches) {
  const to = process.env.ALERT_TO || "adamleaf31@gmail.com";
  const lines = matches.map(({ title, store, url }) =>
    `${title}\nWalmart ${store.name} #${store.number}\n${store.address}, ${store.city}, ON ${store.postalCode}\n${url}`
  );
  await transport().sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: `PS5 Pro found at ${matches.length} Ontario Walmart location${matches.length === 1 ? "" : "s"}`,
    text: `Uber Eats showed this PS5 Pro console as orderable in two fresh checks:\n\n${lines.join("\n\n")}`
  });
}

export async function sendHealthAlert(errors, total) {
  const to = process.env.ALERT_TO || "adamleaf31@gmail.com";
  await transport().sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject: "PS5 Pro monitor needs attention",
    text: `${errors.length} of ${total} Ontario Walmart checks failed. No stock was inferred from failed checks.\n\n${errors.slice(0, 25).join("\n")}`
  });
}
