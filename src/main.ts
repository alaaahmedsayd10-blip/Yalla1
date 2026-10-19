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
  // The Yalla City index passes the signed-in player's six-digit ID in the world URL hash.
  // Show it as a persistent action-bar tile in every map using this shared script.
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const yallaPlayerId = hashParams.get("yallaId") || "";
  if (/^\d{7}$/.test(yallaPlayerId)) {
    WA.ui.actionBar.addButton({
      id: "yalla-player-id",
      label: "🆔 ID: " + yallaPlayerId,
      imageSrc: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f194.png",
      toolTip: "رقم لاعبك الثابت في Yalla City",
      bgColor: "#31215a",
      textColor: "#ffffff",
      isGradient: false,
      location: "actionBar",
      callback: () => {
        WA.chat.sendChatMessage("🆔 رقم اللاعب بتاعي في Yalla City: " + yallaPlayerId, {
          scope: "local",
          author: "🆔 رقم اللاعب",
        });
        WA.chat.open();
      },
    });
  }

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
    label: "🤖 بوت يلا",
    imageSrc: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f916.png",
    toolTip: "افتح شات وتعليمات بوت يلا",
    bgColor: "#202b45",
    textColor: "#ffffff",
    isGradient: false,
    location: "appsMenu",
    callback: () => showHelp(),
  });

  // Games run through the map scripting API and the room chat/events.
  // No external game page, iframe, Firebase, or database is opened.
  const GAME_EVENT = "yalla1-native-game-v1";
  type GamePacket = { kind: string; player?: string; text?: string; answer?: string; round?: number };
  const broadcastGame = (packet: GamePacket) => {
    WA.event.broadcast(GAME_EVENT, packet);
  };
  const gameHelp = () => {
    WA.chat.open();
    sendBotMessage(
      "🎮 ألعاب يلا داخل الخريطة — اكتب في الشات: «ابدأ غميضة»، «ابدأ كويز»، «ابدأ رسم»، «ابدأ كراسي». " +
      "للكويز اكتب إجابتك في الشات، وللرسم اكتب تخمينك. الألعاب بتعلن حالتها للاعبين الموجودين في نفس الغرفة."
    );
  };

  // Custom event subscriptions are not supported by the typings version used by this project.
  // Game announcements remain in the local room chat for now.

  WA.ui.actionBar.addButton({
    id: "yalla-live-games",
    label: "🎮 ألعاب داخل الخريطة",
    imageSrc: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3ae.png",
    toolTip: "ابدأ لعبة جماعية من شات الخريطة",
    bgColor: "#6d28d9",
    textColor: "#ffffff",
    isGradient: false,
    location: "appsMenu",
    callback: () => gameHelp(),
  });

  WA.ui.registerMenuCommand("🎮 ألعاب يلا داخل الخريطة", {
    key: "yalla-live-games-menu",
    callback: () => gameHelp(),
  });

  // Also expose the bot from WorkAdventure's menu on mobile.
  WA.ui.registerMenuCommand("🤖 بوت يلا - مساعدة", {
    key: "yalla-bot-help",
    callback: () => showHelp(),
  });

  WA.chat.onChatMessage((message) => {
    const incoming = message.trim().toLowerCase();
    if (!incoming) return;

    if (/^ابدأ غميضة$|^ابدأ الغميضة$/.test(incoming)) {
      const text = `🙈 غميضة بدأت! ${playerName} أعلن الجولة. اختاروا لاعب يغمّض عينه وعدّوا لـ20، والباقي يستخبّى داخل الخريطة!`;
      sendBotMessage(text); broadcastGame({kind:"announce", player:playerName, text}); return;
    }
    if (/^ابدأ كويز$/.test(incoming)) {
      const text = "🧠 سؤال الكويز: ما عاصمة مصر؟ اكتب إجابتك في الشات. الإجابة الصحيحة: القاهرة.";
      sendBotMessage(text); broadcastGame({kind:"announce", player:playerName, text}); return;
    }
    if (/^ابدأ رسم$|^ابدأ سكريبل$/.test(incoming)) {
      const text = `🎨 جولة تخمين رسم بدأت بقيادة ${playerName}! ارسم على ورقة/أداة الرسم المتاحة لكم، واكتبوا تخميناتكم في الشات. الكلمة السرية للقائد: قطة.`;
      sendBotMessage(text); broadcastGame({kind:"announce", player:playerName, text}); return;
    }
    if (/^ابدأ كراسي$|^ابدأ الكراسي$/.test(incoming)) {
      const text = `🎵 الكراسي الموسيقية بدأت بقيادة ${playerName}! لفّوا حول الكراسي في الخريطة؛ لما القائد يقول «قفوا»، كل لاعب يقف عند كرسي. شيلوا كرسي كل جولة.`;
      sendBotMessage(text); broadcastGame({kind:"announce", player:playerName, text}); return;
    }
    if (/^القاهرة$|^القاهره$/.test(incoming)) {
      sendBotMessage("✅ إجابة صحيحة! نقطة ليك في الكويز 🎉");
      broadcastGame({kind:"answer", player:playerName, answer:message.trim()}); return;
    }
    if (/^خمن:/.test(incoming) || /^تخمين:/.test(incoming)) {
      const guess = message.trim().replace(/^(خمن:|تخمين:)/i, "").trim();
      broadcastGame({kind:"guess", player:playerName, text:guess});
      return;
    }

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
