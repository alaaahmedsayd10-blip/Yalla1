/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";

console.info("Yalla1 welcome bot starting");

WA.onInit().then(async () => {
  await bootstrapExtra().catch((error) =>
    console.warn("Scripting API Extra could not start:", error)
  );

  // This same script is attached to every Yalla1 map.
  // Each visitor receives a private welcome message when the map loads.
  const playerName = WA.player.name?.trim() || "يا بطل";

  const sendBotMessage = (message: string) => {
    WA.chat.sendChatMessage(message, {
      scope: "local",
      author: "🤖 بوت يلا",
    });
  };

  sendBotMessage(
    `🎮 أهلاً ${playerName} في لعبة Yalla! نورت العالم ❤️ استمتع باللعب واكتشف المكان.`
  );

  const showHelp = () => {
    WA.chat.open();
    sendBotMessage(
      "🤖 أهلاً بيك في مساعد Yalla! اكتب «مساعدة» للأوامر، «قوانين» للتعليمات، أو «مرحبا» عشان أرحب بيك."
    );
  };

  WA.ui.actionBar.addButton({
    id: "yalla-help-bot",
    label: "🤖 مساعدة",
    imageSrc: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f916.png",
    toolTip: "افتح شات وتعليمات بوت يلا",
    bgColor: "#202b45",
    textColor: "#ffffff",
    isGradient: false,
    location: "top",
    callback: () => showHelp(),
  });

  // Also expose the bot from WorkAdventure's menu on mobile.
  WA.ui.registerMenuCommand("🤖 مساعدة Yalla", {
    callback: () => showHelp(),
  });

  WA.chat.onChatMessage((message) => {
    const incoming = message.trim().toLowerCase();
    if (!incoming) return;

    const replies: { pattern: RegExp; reply: string | (() => string) }[] = [
      {
        pattern: /بوت|bot|مساعد|يا يلا|yalla bot/,
        reply: "🤖 أنا بوت يلا! اكتب «مساعدة» أو «قوانين» أو «مرحبا» وأنا أساعدك.",
      },
      {
        pattern: /مساعدة|help|أوامر/,
        reply: "🧭 أقدر أرحب بيك وأعرض لك القوانين. اكتب «قوانين» للتعليمات أو «مرحبا» للترحيب.",
      },
      {
        pattern: /قوانين|rules/,
        reply: "📜 قوانين يلا: احترم باقي اللاعبين، خليك لطيف في الشات، ولا تشارك بياناتك الشخصية أو كلمات المرور.",
      },
      {
        pattern: /مرحبا|أهلا|اهلا|السلام عليكم|hello|hi\b/,
        reply: () => `👋 أهلاً ${playerName}! نورت Yalla، استمتع بوقتك ❤️`,
      },
      {
        pattern: /شكرا|شكرًا|thanks/,
        reply: "❤️ العفو يا بطل، نورت Yalla!",
      },
      {
        pattern: /جولد|ذهب|gold|رصيد|متجر|حيوان|shop|شراء|coins?/,
        reply: "🎮 يلا دلوقتي للعب والتجول والتواصل مع اللاعبين، من غير نظام جولد أو متجر حيوانات.",
      },
    ];

    const matched = replies.find((item) => item.pattern.test(incoming));
    if (matched) {
      const reply = typeof matched.reply === "function" ? matched.reply() : matched.reply;
      sendBotMessage(reply);
    }
  }, { scope: "local" });
}).catch((error) => console.error("WorkAdventure API initialization failed:", error));

export {};
