// ========== DONNEES DU QUIZ ==========
const QUIZ_DATA = [
  { text: "Quelle est la principale fonction d'un chaînage dans une maçonnerie ?", options: ["Assurer l'esthétique du mur", "Relier les murs et répartir les efforts", "Protéger contre l'humidité", "Augmenter la hauteur de construction"], correct: 1 },
  { text: "Sur un chantier, que signifie le sigle << EP >> sur un plan ?", options: ["Égout Pluvial", "Équipement Principal", "Espace de Parking", "Énergie Photovoltaïque"], correct: 0 },
  { text: "Dans un projet de fondation, quel type de sol présente généralement le risque de retrait-gonflement le plus important ?", options: ["Sable dense", "Argile plastique", "Grave calcaire", "Roche saine"], correct: 1 },
  { text: "Quelle est la norme européenne de référence pour le calcul des structures en béton armé ?", options: ["Eurocode 1", "Eurocode 2", "Eurocode 5", "Eurocode 7"], correct: 1 },
  { text: "La flèche instantanée d'une poutre en béton armé est principalement due à :", options: ["La fissuration du béton", "La déformation élastique", "Le fluage à long terme", "Le retrait du béton"], correct: 1 },
  { text: "Dans un terrassement, le « coefficient de foisonnement » sert à :", options: ["Calculer la quantité de matériaux compactés", "Estimer l'augmentation de volume après excavation", "Déterminer la portance du sol", "Calculer la pente de talus"], correct: 1 },
  { text: "Selon l'Eurocode 7, dans la combinaison de facteurs pour le dimensionnement géotechnique, quelle approche est généralement la plus défavorable pour le calcul de la portance des fondations superficielles ?", options: ["Combinaison 1 (A1 + M1 + R1)", "Combinaison 2 (A2 + M2 + R1)", "Combinaison 3 (A1 + M2 + R3)", "Combinaison 4 (A2 + M1 + R2)"], correct: 1 },
  { text: "Dans l'analyse dynamique d'une structure, le « facteur de comportement q » (Eurocode 8) permet de :", options: ["Augmenter la période propre de la structure", "Réduire les efforts sismiques en tenant compte de la ductilité", "Calculer uniquement la masse modale", "Déterminer l'amortissement visqueux"], correct: 1 },
  { text: "En modélisation éléments finis d'une dalle en béton, le phénomène de « shear-lag » (retard de cisaillement) affecte principalement :", options: ["La répartition des contraintes de compression dans les membrures larges", "Le flambement local des armatures", "Le fluage différé du béton", "La fissuration de service sous moment négatif"], correct: 0 },
  { text: "Dans le cadre d'une analyse de stabilité globale selon l'Eurocode 7, la méthode « phi-c reduction » (réduction progressive de φ et c) est principalement utilisée pour :", options: ["Calculer la portance d'une fondation", "Déterminer le coefficient de sécurité global d'un talus ou d'un ouvrage en terre", "Évaluer le tassement consolidé", "Dimensionner les écrans de soutènement"], correct: 1 }
];

const TOTAL_QS = QUIZ_DATA.length;
let randomizedQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = new Array(TOTAL_QS).fill(null);
let quizActive = false;
let timerInterval = null;
let startTime = null;
let currentUserName = "";
let quizTimerSeconds = 0;
let waitingForTransition = false;

// DOM elements
const homeScreen = document.getElementById("homeScreen");
const quizScreen = document.getElementById("quizScreen");
const resultScreen = document.getElementById("resultScreen");
const alreadyPlayedScreen = document.getElementById("alreadyPlayedScreen");
const startBtn = document.getElementById("startQuizBtn");
const homeBtn = document.getElementById("homeBtn");
const alreadyPlayedHomeBtn = document.getElementById("alreadyPlayedHomeBtn");
const usernameInput = document.getElementById("username");
const warningMessage = document.getElementById("warningMessage");
const currentQSpan = document.getElementById("currentQ");
const totalQSpan = document.getElementById("totalQ");
const timerDisplay = document.getElementById("timerDisplay");
const progressFill = document.getElementById("progressFill");
const questionTextEl = document.getElementById("questionText");
const answersList = document.getElementById("answersList");
const finalScoreSpan = document.getElementById("finalScore");
const finalTimeSpan = document.getElementById("finalTime");
const congratsMsg = document.getElementById("congratsMsg");
const resultMessageSpan = document.getElementById("resultMessage");
const fullLeaderboardDiv = document.getElementById("fullLeaderboard");
const leaderboardPreviewList = document.getElementById("leaderboardPreviewList");
const alreadyPlayedLeaderboard = document.getElementById("alreadyPlayedLeaderboard");
const previousScoreInfo = document.getElementById("previousScoreInfo");

// ========== FONCTIONS FIREBASE ==========
async function saveScoreToFirebase(name, score, timeSeconds, deviceId) {
  try {
    await window.addDoc(window.collection(window.db, "scores"), {
      name: name,
      score: score,
      time: timeSeconds,
      deviceId: deviceId,
      date: new Date().toISOString()
    });
    console.log("Score sauvegardé dans Firebase");
    return true;
  } catch (error) {
    console.error("Erreur Firebase:", error);
    return false;
  }
}

async function checkIfAlreadyPlayed(deviceId) {
  try {
    const q = window.query(window.collection(window.db, "scores"), window.where("deviceId", "==", deviceId));
    const snapshot = await window.getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Erreur vérification:", error);
    return false;
  }
}

async function getScoresFromFirebase() {
  try {
    const q = window.query(window.collection(window.db, "scores"), window.orderBy("score", "desc"), window.orderBy("time", "asc"));
    const snapshot = await window.getDocs(q);
    const scores = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      scores.push({
        name: data.name,
        score: data.score,
        time: data.time,
        date: new Date(data.date)
      });
    });
    return scores;
  } catch (error) {
    console.error("Erreur récupération:", error);
    return [];
  }
}

function getDeviceId() {
  let deviceId = localStorage.getItem("deviceUniqueId");
  if (!deviceId) {
    deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("deviceUniqueId", deviceId);
  }
  return deviceId;
}

// ========== AFFICHAGE CLASSEMENT ==========
async function updateLeaderboards() {
  const scores = await getScoresFromFirebase();
  
  // Classement preview (top 3)
  if (leaderboardPreviewList) {
    if (scores.length === 0) {
      leaderboardPreviewList.innerHTML = "Aucun score pour l'instant";
    } else {
      let html = "";
      for (let i = 0; i < Math.min(3, scores.length); i++) {
        const s = scores[i];
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "📌";
        html += `<div class="score-row"><span>${medal} ${s.name.substring(0, 18)}</span><span><strong>${s.score}/${TOTAL_QS}</strong> ${formatTime(s.time)}</span></div>`;
      }
      if (scores.length > 3) html += `<div style="text-align:center; margin-top:8px;">+ ${scores.length-3} autres</div>`;
      leaderboardPreviewList.innerHTML = html;
    }
  }
  
  // Classement complet
  if (fullLeaderboardDiv) {
    if (scores.length === 0) {
      fullLeaderboardDiv.innerHTML = "<div class='score-row'>Aucun score</div>";
    } else {
      let html = "";
      for (let i = 0; i < Math.min(10, scores.length); i++) {
        const s = scores[i];
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
        html += `<div class="score-row"><span>${medal} ${s.name.substring(0, 18)}</span><span><strong>${s.score}/${TOTAL_QS}</strong> ${formatTime(s.time)}</span></div>`;
      }
      fullLeaderboardDiv.innerHTML = html;
    }
  }
}

// ========== TIMER ==========
function formatTime(sec) {
  let minutes = Math.floor(sec / 60);
  let seconds = sec % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
function startGlobalTimer() {
  stopTimer();
  startTime = Date.now() - (quizTimerSeconds * 1000);
  timerInterval = setInterval(() => {
    if (!quizActive) return;
    quizTimerSeconds = Math.floor((Date.now() - startTime) / 1000);
    if (timerDisplay) timerDisplay.textContent = formatTime(quizTimerSeconds);
  }, 1000);
}

function resetQuizState() {
  currentQuestionIndex = 0;
  userAnswers.fill(null);
  quizTimerSeconds = 0;
  if (timerDisplay) timerDisplay.textContent = "00:00";
  stopTimer();
  quizActive = false;
  waitingForTransition = false;
}

// ========== RANDOMISATION ==========
function shuffleQuestions() {
  randomizedQuestions = [...QUIZ_DATA];
  for (let i = randomizedQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [randomizedQuestions[i], randomizedQuestions[j]] = [randomizedQuestions[j], randomizedQuestions[i]];
  }
  return randomizedQuestions;
}

// ========== CHARGEMENT QUESTION ==========
function loadQuestion() {
  if (!quizActive) return;
  const qData = randomizedQuestions[currentQuestionIndex];
  if (questionTextEl) questionTextEl.textContent = qData.text;
  if (answersList) answersList.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  qData.options.forEach((opt, idx) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "answer-option";
    optionDiv.innerHTML = `<span class="prefix-letter">${letters[idx]}</span><span>${opt}</span>`;
    optionDiv.dataset.index = idx;
    optionDiv.onclick = () => {
      if (!quizActive || waitingForTransition) return;
      const isCorrect = (idx === qData.correct);
      userAnswers[currentQuestionIndex] = idx;
      const allOptions = document.querySelectorAll(".answer-option");
      allOptions.forEach(opt => {
        const optIndex = parseInt(opt.dataset.index);
        if (optIndex === qData.correct) {
          opt.style.background = "rgba(40, 167, 69, 0.85)";
          opt.style.border = "2px solid #28a745";
        }
        if (optIndex === idx && optIndex !== qData.correct) {
          opt.style.background = "rgba(220, 53, 69, 0.85)";
          opt.style.border = "2px solid #dc3545";
        }
        if (optIndex === idx && optIndex === qData.correct) opt.style.background = "rgba(40, 167, 69, 1)";
        opt.style.pointerEvents = "none";
      });
      const feedbackIcon = document.createElement("div");
      feedbackIcon.className = "feedback-icon";
      feedbackIcon.innerHTML = isCorrect ? "✓ Bonne réponse !" : `✗ Mauvaise réponse. La bonne réponse était : ${letters[qData.correct]} - ${qData.options[qData.correct]}`;
      feedbackIcon.style.cssText = `position:fixed; bottom:30px; left:50%; transform:translateX(-50%); padding:12px 20px; border-radius:50px; color:white; font-weight:bold; font-size:0.9rem; z-index:1000; text-align:center; white-space:nowrap; background:${isCorrect ? "rgba(40,167,69,0.9)" : "rgba(220,53,69,0.9)"}; box-shadow:0 4px 15px rgba(0,0,0,0.3); animation:fadeInUp 0.3s ease`;
      document.body.appendChild(feedbackIcon);
      waitingForTransition = true;
      setTimeout(() => { feedbackIcon.remove(); goToNextQuestion(); }, 1200);
    };
    if (answersList) answersList.appendChild(optionDiv);
  });
  if (currentQSpan) currentQSpan.textContent = currentQuestionIndex + 1;
  if (totalQSpan) totalQSpan.textContent = TOTAL_QS;
  if (progressFill) progressFill.style.width = `${(currentQuestionIndex / TOTAL_QS) * 100}%`;
}

function goToNextQuestion() {
  if (!quizActive) return;
  if (currentQuestionIndex + 1 < TOTAL_QS) {
    const quizCard = document.querySelector(".quiz-card");
    if (quizCard) { quizCard.style.transform = "scale(0.98)"; quizCard.style.opacity = "0.7"; }
    setTimeout(() => {
      currentQuestionIndex++;
      waitingForTransition = false;
      loadQuestion();
      if (quizCard) { quizCard.style.transform = "scale(1)"; quizCard.style.opacity = "1"; }
    }, 150);
  } else { finishQuiz(); }
}

function launchCelebration(score) {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const confettiCount = 100 + (score - 7) * 20;
  const colors = ['#FFD700', '#FFA500', '#FFC107', '#FFB347', '#FFD966', '#FFFFFF'];
  for (let i = 0; i < confettiCount; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.width = (Math.random() * 8 + 5) + 'px';
      confetti.style.height = (Math.random() * 8 + 5) + 'px';
      container.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3500);
    }, i * 30);
  }
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const star = document.createElement('div');
      star.className = 'star';
      star.innerHTML = '⭐';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = '50%';
      star.style.position = 'fixed';
      star.style.fontSize = (Math.random() * 20 + 15) + 'px';
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 2000);
    }, i * 100);
  }
  const scoreElement = document.getElementById('finalScore');
  if (scoreElement) { scoreElement.classList.add('score-highlight'); setTimeout(() => scoreElement.classList.remove('score-highlight'), 2400); }
  const congratsElement = document.getElementById('congratsMsg');
  if (congratsElement) { congratsElement.classList.add('congrats-firework'); setTimeout(() => congratsElement.classList.remove('congrats-firework'), 2500); }
  setTimeout(() => container.remove(), 5000);
}

async function finishQuiz() {
  quizActive = false; stopTimer();
  let score = 0;
  for (let i = 0; i < TOTAL_QS; i++) {
    if (userAnswers[i] === randomizedQuestions[i].correct) score++;
  }
  if (finalScoreSpan) finalScoreSpan.textContent = score;
  if (finalTimeSpan) finalTimeSpan.textContent = formatTime(quizTimerSeconds);
  
  if (score === TOTAL_QS) {
    resultMessageSpan.textContent = "Parfait ! Vous êtes un expert du génie civil !";
    congratsMsg.textContent = "🏆 Score Parfait 🏆";
  } else if (score >= 8) {
    resultMessageSpan.textContent = "Très bonne performance !";
    congratsMsg.textContent = "🎉 Excellent !";
  } else if (score >= 7) {
    resultMessageSpan.textContent = "Bon travail ! Solides connaissances !";
    congratsMsg.textContent = "🎊 Bravo !";
  } else if (score >= 5) {
    resultMessageSpan.textContent = "Bon travail, une petite révision s'impose !";
    congratsMsg.textContent = "👍 Bien joué !";
  } else {
    resultMessageSpan.textContent = "Continuez à apprendre, le BTP vous attend !";
    congratsMsg.textContent = "📚 Merci !";
  }
  
  if (score >= 7) launchCelebration(score);
  
  let userName = currentUserName.trim();
  if (userName === "") userName = "Anonyme";
  const deviceId = getDeviceId();
  
  await saveScoreToFirebase(userName, score, quizTimerSeconds, deviceId);
  
  await updateLeaderboards();
  showScreen("result");
}

function showWarning(msg) {
  if (warningMessage) {
    warningMessage.textContent = msg;
    warningMessage.classList.add("show");
    setTimeout(() => warningMessage.classList.remove("show"), 3000);
  }
}

function showScreen(screenName) {
  if (homeScreen) homeScreen.classList.remove("active");
  if (quizScreen) quizScreen.classList.remove("active");
  if (resultScreen) resultScreen.classList.remove("active");
  if (alreadyPlayedScreen) alreadyPlayedScreen.classList.remove("active");
  
  if (screenName === "home" && homeScreen) homeScreen.classList.add("active");
  else if (screenName === "quiz" && quizScreen) quizScreen.classList.add("active");
  else if (screenName === "result" && resultScreen) resultScreen.classList.add("active");
  else if (screenName === "alreadyPlayed" && alreadyPlayedScreen) alreadyPlayedScreen.classList.add("active");
}

async function showAlreadyPlayedScreen() {
  const deviceId = getDeviceId();
  const played = await checkIfAlreadyPlayed(deviceId);
  if (previousScoreInfo) {
    if (played) {
      previousScoreInfo.innerHTML = `<div class="previous-score-card"><strong>📊</strong><br>🔒 Cet appareil a déjà participé.<br>Une seule participation par personne !</div>`;
    } else {
      previousScoreInfo.innerHTML = "Vous n'avez pas encore participé.";
    }
  }
  updateLeaderboards();
  showScreen("alreadyPlayed");
}

async function startQuiz() {
  const deviceId = getDeviceId();
  const alreadyPlayed = await checkIfAlreadyPlayed(deviceId);
  if (alreadyPlayed) { showAlreadyPlayedScreen(); return; }
  
  const userName = usernameInput ? usernameInput.value.trim() : "";
  if (userName === "") { showWarning("Veuillez entrer votre nom"); return; }
  
  currentUserName = userName;
  shuffleQuestions();
  resetQuizState();
  quizActive = true;
  startGlobalTimer();
  loadQuestion();
  showScreen("quiz");
}

function backToHome() { resetQuizState(); if (usernameInput) usernameInput.value = ""; showScreen("home"); updateLeaderboards(); }

// Event listeners
if (startBtn) startBtn.onclick = startQuiz;
if (homeBtn) homeBtn.onclick = backToHome;
if (alreadyPlayedHomeBtn) alreadyPlayedHomeBtn.onclick = backToHome;

// Initialisation
async function init() {
  if (totalQSpan) totalQSpan.textContent = TOTAL_QS;
  const totalQuestionsSpan = document.getElementById("totalQuestions");
  if (totalQuestionsSpan) totalQuestionsSpan.textContent = TOTAL_QS;
  await updateLeaderboards();
  showScreen("home");
  resetQuizState();
  if (usernameInput) usernameInput.value = "";
}
init();