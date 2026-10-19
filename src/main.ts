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
      location: "appsMenu",
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

  // Lightweight mini-games and zodiac fun, available directly from map chat.
const quizQuestions = [
  { q: "ما عاصمة مصر؟", a: "القاهرة", aliases: ["القاهره"] },
  { q: "كم يومًا في الأسبوع؟", a: "7", aliases: ["سبعة", "سبعه"] },
  { q: "ما الكوكب المعروف بالكوكب الأحمر؟", a: "المريخ", aliases: [] },
  { q: "كم ضلعًا للمثلث؟", a: "3", aliases: ["ثلاثة", "ثلاثه"] },
  { q: "ما أكبر حيوان يعيش على الأرض؟", a: "الحوت الأزرق", aliases: ["الحوت الازرق"] },
  { q: "ما ناتج 8 × 7؟", a: "56", aliases: ["ستة وخمسون", "سته وخمسون"] },
];
let activeQuizAnswer = "";
let activeRiddleAnswer = "";
let numberToGuess: number | null = null;

const normalizeAnswer = (value: string) =>
  value.trim().toLowerCase().replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا");

const zodiacFor = (day: number, month: number): string | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const signs: [number, number, string][] = [
    [3, 21, "الحمل"], [4, 20, "الثور"], [5, 21, "الجوزاء"],
    [6, 21, "السرطان"], [7, 23, "الأسد"], [8, 23, "العذراء"],
    [9, 23, "الميزان"], [10, 23, "العقرب"], [11, 22, "القوس"],
    [12, 22, "الجدي"], [1, 20, "الدلو"], [2, 19, "الحوت"],
  ];
  for (let i = signs.length - 1; i >= 0; i--) {
    const [startMonth, startDay, sign] = signs[i];
    if (month === startMonth && day >= startDay) return sign;
    if (month === startMonth + 1 && day < startDay) return sign;
  }
  return month === 1 ? "الجدي" : "الحوت";
};

const handleMiniGame = (raw: string): boolean => {
  const input = normalizeAnswer(raw);
  if (/^(برجي|برجى|حظي|حظى)$/.test(input)) {
    sendBotMessage("♈ اكتب يوم وشهر ميلادك بالشكل ده: برجي 15/5 — وهقولك برجك وصفة لطيفة للتسلية 😊");
    return true;
  }
  const birth = input.match(/^(?:برجي|برجى|حظي|حظى)\\s+(\\d{1,2})[\\/.-](\\d{1,2})$/);
  if (birth) {
    const sign = zodiacFor(Number(birth[1]), Number(birth[2]));
    if (!sign) sendBotMessage("اكتب التاريخ بشكل صحيح مثل: برجي 15/5 😊");
    else {
      const fortunes: Record<string, string> = {
        "الحمل": "طاقتك عالية؛ جرّب حاجة جديدة وخد وقتك قبل القرارات.",
        "الثور": "يوم مناسب للهدوء وترتيب أفكارك ومساعدة صديق.",
        "الجوزاء": "الكلام اللطيف والتعارف ممكن يخلّوا يومك أحلى.",
        "السرطان": "اهتم بنفسك وبالناس القريبين منك.",
        "الأسد": "شارك إبداعك وخلي ثقتك بنفسك متوازنة.",
        "العذراء": "خطوة صغيرة منظمة ممكن تفرق معاك.",
        "الميزان": "حاول توازن بين اللعب والراحة.",
        "العقرب": "خليك فضولي، لكن اسأل بلطف.",
        "القوس": "مغامرة بسيطة أو لعبة جديدة ممكن تبسطك.",
        "الجدي": "ركز على هدف صغير واحتفل بإنجازه.",
        "الدلو": "فكرة مختلفة منك ممكن تضحّك أصحابك.",
        "الحوت": "استخدم خيالك وشارك أصحابك حاجة حلوة."
      };
      sendBotMessage("✨ برجك " + sign + "! " + fortunes[sign] + " (للتسلية فقط، مش تنبؤ حقيقي بالمستقبل.)");
    }
    return true;
  }
  if (/^(ابدأ كويز|لعبة سؤال|سؤال عشوائي|كويز)$/.test(input)) {
    const item = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    activeQuizAnswer = item.a;
    sendBotMessage("🧠 سؤال سريع: " + item.q + " — اكتب إجابتك هنا في الشات!");
    return true;
  }
  if (/^(لغز|ابدأ لغز|لعبة ألغاز|لعبه الغاز)$/.test(input)) {
    const riddles = [
      { q: "إيه الشيء اللي له أسنان ومابيعضش؟", a: "المشط" },
      { q: "إيه الشيء اللي كل ما تاخد منه يكبر؟", a: "الحفرة" },
      { q: "له عين ولا يرى، إيه هو؟", a: "الإبرة" },
    ];
    const item = riddles[Math.floor(Math.random() * riddles.length)];
    activeRiddleAnswer = normalizeAnswer(item.a);
    sendBotMessage("🧩 لغز يلا: " + item.q + " اكتب الحل!");
    return true;
  }
  if (/^(لعبة رقم|خمن رقم|خمن رقم|ابدأ تخمين رقم)$/.test(input)) {
    numberToGuess = Math.floor(Math.random() * 10) + 1;
    sendBotMessage("🔢 اخترت رقمًا من 1 لـ10. اكتب تخمينك كرقم!");
    return true;
  }
  if (activeQuizAnswer && (input === normalizeAnswer(activeQuizAnswer) || quizQuestions.some(q => normalizeAnswer(q.a) === input || q.aliases.some(a => normalizeAnswer(a) === input)) && quizQuestions.some(q => normalizeAnswer(q.a) === normalizeAnswer(activeQuizAnswer) && q.aliases.some(a => normalizeAnswer(a) === input)))) {
    sendBotMessage("✅ برافو! إجابة صحيحة 🎉 اكتب «لعبة سؤال» لسؤال جديد.");
    activeQuizAnswer = "";
    return true;
  }
  if (activeRiddleAnswer && input === activeRiddleAnswer) {
    sendBotMessage("🎉 صح عليك! حل اللغز مظبوط. اكتب «لغز» للغز جديد.");
    activeRiddleAnswer = "";
    return true;
  }
  if (numberToGuess !== null && /^\\d+$/.test(input)) {
    const guess = Number(input);
    if (guess === numberToGuess) {
      sendBotMessage("🎉 صح! الرقم كان " + numberToGuess + ". اكتب «خمن رقم» لجولة جديدة.");
      numberToGuess = null;
    } else if (guess >= 1 && guess <= 10) {
      sendBotMessage(guess < numberToGuess ? "⬆️ جرّب رقم أكبر!" : "⬇️ جرّب رقم أصغر!");
    }
    return true;
  }
  if (/^(العاب|ألعاب|العاب يلا|ألعاب يلا|games)$/.test(input)) {
    sendBotMessage("🎮 ألعاب بوت يلا: «لعبة سؤال» للكويز، «لغز» للألغاز، «خمن رقم» لتخمين رقم، «برجي 15/5» لمعرفة برجك للتسلية.");
    return true;
  }
  return false;
};



  WA.chat.onChatMessage((message) => {
    const incoming = message.trim().toLowerCase();
    if (!incoming) return;
    if (handleMiniGame(message)) return;

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
        reply: "🧭 اكتب «ألعاب» لعرض الألعاب، «برجي» للأبراج، «قوانين» للتعليمات أو «مرحبا» للترحيب.",
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
