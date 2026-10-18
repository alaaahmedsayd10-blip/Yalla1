/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra } from "@workadventure/scripting-api-extra";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, getFirestore, onSnapshot, runTransaction } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const LOGIN_URL = "https://alaaahmedsayd10-blip.github.io/Yalla1/login.html";
const USER_UID_KEY = "yalla_user_uid";
const RULES_KEY_PREFIX = "yalla_rules_accepted_";

const ANIMALS = [
  { id: "cat", label: "قطة", price: 2, emoji: "🐱" },
  { id: "dog", label: "كلب", price: 3, emoji: "🐶" },
  { id: "horse", label: "حصان", price: 10, emoji: "🐴" },
  { id: "lion", label: "أسد", price: 20, emoji: "🦁" },
] as const;

type AnimalId = (typeof ANIMALS)[number]["id"];
let currentUser: User | null = null;
let currentGold = 0;
let currentPopup: { close: () => void } | undefined;
let goldUnsubscribe: (() => void) | undefined;
let loginModalOpen = false;
let rulesPopupShown = false;
let shopPopupOpen = false;

console.info("Yalla1 Firebase game script starting");

WA.onInit().then(async () => {
  await bootstrapExtra().catch((error) => console.warn("Scripting API Extra could not start:", error));

  // YALLA_JOIN_WELCOME: greet this player locally when the map finishes loading.
  // WorkAdventure map scripts run in each visitor's browser, so this is a private/local greeting,
  // not a broadcast message to everyone else in the room.
  const welcomeName = WA.player.name?.trim() || "يا بطل";
  WA.chat.sendChatMessage(`🎮 أهلاً ${welcomeName} في لعبة Yalla! نورت العالم ❤️ استمتع باللعب واكتشف المدينة.`, { scope: "local" });

  // YALLA_BOT_V5: interactive in-game helper. Replies locally when the player
  // sends a message containing a supported keyword.
  const chatApi = WA.chat as unknown as {
    onChatMessage?: { subscribe?: (callback: (event: { message?: string; author?: string }) => void) => unknown };
  };
  chatApi.onChatMessage?.subscribe?.((event) => {
    const incoming = (event.message || "").trim().toLowerCase();
    if (!incoming) return;
    const replies: Array<[RegExp, string]> = [
      [/بوت|bot|مساعد|يا يلا|yalla bot/, "🤖 أنا بوت يلا! أقدر أساعدك. اكتب: مساعدة أو جولد أو متجر أو قوانين."],
      [/مساعدة|help|أوامر/, "🧭 أوامري: اكتب «جولد» لمعرفة رصيدك، «متجر» لمعرفة طريقة الشراء، «قوانين» لعرض القوانين، أو «مساعدة» لعرض الأوامر."],
      [/جولد|ذهب|gold|رصيد/, () => currentUser ? `🪙 رصيدك الحالي ${currentGold} جولد.` : "🔐 سجّل الدخول أولًا عشان تتابع رصيد الجولد."],
      [/متجر|حيوان|shop|شراء/, "🛍️ عشان تفتح متجر الحيوانات، روح لمنطقة المتجر داخل الخريطة. تقدر تشتري قطة بـ2 جولد، كلب بـ3، حصان بـ10، أو أسد بـ20."],
      [/قوانين|rules/, "📜 قوانين يلا: احترم اللاعبين، لا تشارك كلمة المرور، وتأكد من رصيدك قبل الشراء."],
      [/مرحبا|أهلا|اهلا|السلام عليكم|hello|hi\b/, () => `👋 أهلًا ${welcomeName}! نورت Yalla City. محتاج مساعدة؟ اكتب «مساعدة».`],
      [/شكرا|شكرًا|thanks/, "❤️ العفو يا بطل، استمتع في Yalla City!"],
    ];
    const matched = replies.find(([pattern]) => pattern.test(incoming));
    if (matched) {
      const reply = typeof matched[1] === "function" ? matched[1]() : matched[1];
      WA.chat.sendChatMessage(reply, { scope: "local" });
    }
  });

  // A modal login gate is used because WorkAdventure map scripts run in a sandboxed iframe.
  const openLogin = () => {
    if (loginModalOpen || currentUser) return;
    loginModalOpen = true;
    WA.ui.modal.openModal({
      title: "Yalla City Login",
      src: LOGIN_URL,
      position: "center",
      allowApi: true,
      closable: true,
      allow: null,
      allowFullScreen: false,
    });
  };

  const showRulesIfNeeded = () => {
    if (!currentUser || rulesPopupShown) return;
    const key = RULES_KEY_PREFIX + currentUser.uid;
    if (localStorage.getItem(key) === "yes") return;
    rulesPopupShown = true;
    currentPopup = WA.ui.openPopup("rulesPopup", "قوانين Yalla City\n\n1. احترم باقي اللاعبين.\n2. لا تشارك كلمة المرور مع أي شخص.\n3. تبدأ حسابات اللاعبين الجدد بـ 5 جولد فقط.\n4. عمليات الشراء تخصم الجولد من حسابك.\n5. استخدم المتجر داخل المنطقة المحددة فقط.", [
      {
        label: "موافق",
        className: "success",
        callback: (popup) => {
          localStorage.setItem(key, "yes");
          popup.close();
          currentPopup = undefined;
        },
      },
    ]);
  };

  const updateGoldBanner = (gold: number) => {
    currentGold = gold;
    WA.ui.banner.openBanner({
      id: "yalla-gold-banner",
      text: `🪙 جولدك الحالي: ${gold}`,
      bgColor: "#202b45",
      textColor: "#ffffff",
      closable: false,
      timeToClose: 0,
    });
  };

  const purchaseAnimal = async (animalId: AnimalId) => {
    if (!currentUser) {
      openLogin();
      return;
    }
    const animal = ANIMALS.find((item) => item.id === animalId);
    if (!animal) return;
    const userRef = doc(db, "users", currentUser.uid);
    try {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(userRef);
        if (!snapshot.exists()) throw new Error("ملف اللاعب غير موجود. سجل الخروج ثم الدخول مرة أخرى.");
        const data = snapshot.data();
        const gold = Number(data.gold ?? 0);
        const animals = Array.isArray(data.animals) ? data.animals : [];
        if (gold < animal.price) throw new Error(`الجولد غير كافي. تحتاج ${animal.price} جولد لشراء ${animal.label}.`);
        transaction.update(userRef, { gold: gold - animal.price, animals: [...animals, animal.id] });
      });
      WA.chat.sendChatMessage(`تم شراء ${animal.label} بنجاح!`, { scope: "local" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "حصل خطأ أثناء الشراء.";
      WA.chat.sendChatMessage(message, { scope: "local" });
    }
  };

  const openShop = () => {
    // The meeting-table/chair area is also the shop interaction point.
    // If the visitor is not authenticated, open the account screen instead of silently doing nothing.
    if (!currentUser) {
      openLogin();
      return;
    }
    if (shopPopupOpen) return;
    shopPopupOpen = true;
    const buttons = ANIMALS.map((animal) => ({
      label: `${animal.emoji} ${animal.label} — ${animal.price} جولد`,
      className: "primary" as const,
      callback: (popup: { close: () => void }) => {
        popup.close();
        shopPopupOpen = false;
        void purchaseAnimal(animal.id);
      },
    }));
    buttons.push({
      label: "إغلاق المتجر",
      className: "primary" as const,
      callback: (popup: { close: () => void }) => {
        popup.close();
        shopPopupOpen = false;
      },
    });
    currentPopup = WA.ui.openPopup("shopPopup", `🛍️ متجر الحيوانات\nرصيدك الحالي: ${currentGold} جولد\nاختر الحيوان الذي تريد شراءه:`, buttons);
  };

  const onSignedIn = async (user: User) => {
    currentUser = user;
    localStorage.setItem(USER_UID_KEY, user.uid);
    if (goldUnsubscribe) goldUnsubscribe();
    const userRef = doc(db, "users", user.uid);
    try {
      const snapshot = await getDoc(userRef);
      if (!snapshot.exists()) {
        WA.chat.sendChatMessage("ملف حسابك غير موجود في Firestore. تواصل مع إدارة اللعبة.", { scope: "local" });
        return;
      }
      const initialGold = Number(snapshot.data().gold ?? 0);
      updateGoldBanner(initialGold);
      goldUnsubscribe = onSnapshot(userRef, (updated) => {
        if (updated.exists()) updateGoldBanner(Number(updated.data().gold ?? 0));
      }, (error) => console.error("Gold listener error:", error));
      loginModalOpen = false;
      showRulesIfNeeded();
    } catch (error) {
      console.error("Could not load player profile:", error);
      WA.chat.sendChatMessage("تعذر تحميل حسابك. تأكد من إعداد Firestore Rules.", { scope: "local" });
    }
  };

  onAuthStateChanged(auth, (user) => {
    if (user) {
      void onSignedIn(user);
    } else {
      currentUser = null;
      localStorage.removeItem(USER_UID_KEY);
      openLogin();
    }
  });

  // The login iframe and this map script share the GitHub Pages origin.
  window.addEventListener("storage", (event) => {
    if (event.key === USER_UID_KEY && event.newValue) {
      // Firebase Auth's persisted state will trigger onAuthStateChanged as well.
      loginModalOpen = false;
    }
  });

  WA.room.area.onEnter("shop").subscribe(() => openShop());
  WA.room.area.onLeave("shop").subscribe(() => {
    if (currentPopup) {
      currentPopup.close();
      currentPopup = undefined;
    }
    shopPopupOpen = false;
  });


  // Refresh profile on focus so the banner stays correct after returning from the login modal.
  window.addEventListener("focus", async () => {
    if (!currentUser) return;
    try {
      const snapshot = await getDoc(doc(db, "users", currentUser.uid));
      if (snapshot.exists()) updateGoldBanner(Number(snapshot.data().gold ?? 0));
    } catch (error) {
      console.warn("Could not refresh gold:", error);
    }
  });
}).catch((error) => console.error("WorkAdventure API initialization failed:", error));

export {};
