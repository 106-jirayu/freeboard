import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getDatabase, limitToLast, onValue, orderByChild, query, ref } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const metrics = {
  temperature: { label: "อุณหภูมิอากาศ", unit: "°C", digits: 1, min: 18, max: 40, status: (v) => v > 32 ? "ร้อนเกินเป้าหมาย" : v < 24 ? "อุณหภูมิต่ำ" : "อยู่ในช่วงเหมาะสม", alert: (v) => v > 32 || v < 24 },
  humidity: { label: "ความชื้นสัมพัทธ์", unit: "%", digits: 0, min: 20, max: 100, status: (v) => v > 75 ? "ความชื้นสูง" : v < 55 ? "อากาศค่อนข้างแห้ง" : "อยู่ในช่วงเหมาะสม", alert: (v) => v > 75 || v < 55 },
  co2: { label: "คาร์บอนไดออกไซด์", unit: "ppm", digits: 0, min: 350, max: 1500, status: (v) => v > 1000 ? "ระบายอากาศ" : "อยู่ในช่วงเฝ้าระวัง", alert: (v) => v > 1000 },
  light: { label: "ความเข้มแสง", unit: "lux", digits: 0, min: 0, max: 2000, status: (v) => v < 300 ? "แสงน้อย" : v > 1200 ? "แสงค่อนข้างแรง" : "อยู่ในช่วงเหมาะสม", alert: (v) => v < 300 || v > 1200 },
  soil_moisture: { label: "ความชื้นในดิน", unit: "%", digits: 0, min: 0, max: 100, status: (v) => v < 30 ? "ควรตรวจและรดน้ำ" : v > 85 ? "ดินชื้นมาก" : "ความชื้นเพียงพอ", alert: (v) => v < 30 || v > 85 },
  battery: { label: "แรงดันแบตเตอรี่", unit: "V", digits: 2, min: 3.3, max: 4.3, status: (v) => v < 3.7 ? "ตรวจสอบแหล่งจ่าย" : "พลังงานปกติ", alert: (v) => v < 3.7 }
};

const chartMetrics = {
  temperature: { label: "อุณหภูมิอากาศ", unit: "°C", color: "#d7783c" },
  humidity: { label: "ความชื้นสัมพัทธ์", unit: "%", color: "#548eae" },
  co2: { label: "คาร์บอนไดออกไซด์", unit: "ppm", color: "#a67938" }
};

let historyRows = [];
let selectedMetric = "temperature";
let latestTimestamp = 0;
const canvas = document.querySelector("#history-chart");
const chartEmpty = document.querySelector("#chart-empty");

function setConnection(state, label) {
  document.querySelector("#connection-dot").className = `connection-dot ${state}`;
  document.querySelector("#connection-text").textContent = label;
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function renderMetric(key, value) {
  const definition = metrics[key];
  const numericValue = Number(value);
  if (!definition || !Number.isFinite(numericValue)) return;
  const id = key === "soil_moisture" ? "soil" : key;
  document.querySelector(`#${id}-value`).textContent = formatNumber(numericValue, definition.digits);
  const status = document.querySelector(`#${id}-status`);
  status.textContent = definition.status(numericValue);
  status.classList.toggle("status-alert", definition.alert(numericValue));
  const percentage = Math.max(2, Math.min(100, ((numericValue - definition.min) / (definition.max - definition.min)) * 100));
  document.querySelector(`#${id}-bar`).style.width = `${percentage}%`;
}

function buildFieldNote(data) {
  const warnings = [];
  if (Number(data.soil_moisture) < 30) warnings.push("ดินเริ่มแห้ง ควรตรวจความชื้นก่อนรดน้ำ");
  if (Number(data.co2) > 1000) warnings.push("CO₂ สูง ควรเพิ่มการถ่ายเทอากาศ");
  if (Number(data.temperature) > 32) warnings.push("อุณหภูมิสูงกว่าช่วงเป้าหมาย");
  if (Number(data.battery) < 3.7) warnings.push("แรงดันแบตเตอรี่ต่ำ ควรตรวจแหล่งจ่ายไฟ");
  if (warnings.length) return warnings.join(" · ");
  return "ค่าที่ตรวจวัดอยู่ในช่วงเฝ้าระวังที่กำหนด ระบบติดตามข้อมูลต่อเนื่อง";
}

function renderLatest(data) {
  if (!data || typeof data !== "object") return;
  Object.keys(metrics).forEach((key) => renderMetric(key, data[key]));
  const timestamp = Number(data.timestamp);
  if (Number.isFinite(timestamp) && timestamp > 0) {
    latestTimestamp = timestamp;
    const date = new Date(timestamp * 1000);
    const time = date.toLocaleTimeString("th-TH", { hour12: false });
    document.querySelector("#updated-at").textContent = time;
    document.querySelector("#device-state").textContent = `ออนไลน์ · ${time}`;
  }
  document.querySelector("#field-note").textContent = buildFieldNote(data);
  setConnection("connected", "รับข้อมูลสด");
  document.querySelector("#notice").hidden = true;
}

function renderChart() {
  const context = canvas.getContext("2d");
  if (!context) return;
  const bounds = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
  canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = bounds.width;
  const height = bounds.height;
  const metric = chartMetrics[selectedMetric];
  const points = historyRows.map((row) => Number(row[selectedMetric])).filter(Number.isFinite);
  document.querySelector("#chart-caption").textContent = `${metric.label} · ${metric.unit}`;
  document.querySelector("#history-count").textContent = `${points.length} จุดข้อมูล`;
  chartEmpty.hidden = points.length > 1;
  context.clearRect(0, 0, width, height);

  const left = 8;
  const right = width - 8;
  const top = 13;
  const bottom = height - 12;
  context.lineWidth = 1;
  context.strokeStyle = "#edf1ec";
  for (let row = 0; row < 4; row += 1) {
    const y = top + ((bottom - top) * row) / 3;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
  }
  if (points.length < 2) return;

  const minimum = Math.min(...points);
  const maximum = Math.max(...points);
  const spread = maximum - minimum || Math.max(1, Math.abs(maximum) * 0.08);
  const low = minimum - spread * 0.18;
  const high = maximum + spread * 0.18;
  const coordinates = points.map((value, index) => ({
    x: left + ((right - left) * index) / (points.length - 1),
    y: bottom - ((value - low) / (high - low)) * (bottom - top)
  }));

  const fill = context.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, `${metric.color}33`);
  fill.addColorStop(1, `${metric.color}00`);
  context.beginPath();
  context.moveTo(coordinates[0].x, bottom);
  coordinates.forEach((point) => context.lineTo(point.x, point.y));
  context.lineTo(coordinates.at(-1).x, bottom);
  context.closePath();
  context.fillStyle = fill;
  context.fill();

  context.beginPath();
  coordinates.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  context.strokeStyle = metric.color;
  context.lineWidth = 2.5;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();
  const last = coordinates.at(-1);
  context.beginPath();
  context.arc(last.x, last.y, 4, 0, Math.PI * 2);
  context.fillStyle = metric.color;
  context.fill();
  context.beginPath();
  context.arc(last.x, last.y, 7, 0, Math.PI * 2);
  context.strokeStyle = `${metric.color}44`;
  context.lineWidth = 2;
  context.stroke();
}

function updateHistory(data) {
  historyRows = Object.values(data || {})
    .filter((row) => row && typeof row === "object" && Number.isFinite(Number(row.timestamp)))
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
    .slice(-120);
  renderChart();
}

document.querySelectorAll(".chart-tab").forEach((button) => {
  button.addEventListener("click", () => {
    selectedMetric = button.dataset.metric;
    document.querySelectorAll(".chart-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
    renderChart();
  });
});

document.querySelector("#today-label").textContent = `BANGKOK · ${new Date().toLocaleTimeString("th-TH", { hour12: false, hour: "2-digit", minute: "2-digit" })}`;
window.addEventListener("resize", renderChart);
renderChart();

if (!isFirebaseConfigured) {
  setConnection("error", "ยังไม่ตั้งค่า Firebase");
  document.querySelector("#notice-text").textContent = "ตั้งค่า Firebase Web App ใน firebase-config.js และเปิด Realtime Database ก่อน จึงจะแสดงข้อมูลสดได้";
  document.querySelector("#notice").hidden = false;
} else {
  try {
    const database = getDatabase(initializeApp(firebaseConfig));
    onValue(ref(database, "lab/esp32/latest"), (snapshot) => {
      const data = snapshot.val();
      if (data) renderLatest(data);
      else {
        setConnection("error", "ยังไม่มีข้อมูล");
        document.querySelector("#notice-text").textContent = "ยังไม่พบข้อมูลใน lab/esp32/latest ตรวจการเชื่อมต่อ ESP32 และชื่อฐานข้อมูล";
        document.querySelector("#notice").hidden = false;
      }
    }, (error) => {
      setConnection("error", "เชื่อมต่อไม่สำเร็จ");
      document.querySelector("#notice-text").textContent = `อ่านข้อมูล Firebase ไม่สำเร็จ: ${error.message}`;
      document.querySelector("#notice").hidden = false;
    });
    onValue(query(ref(database, "lab/esp32/history"), orderByChild("timestamp"), limitToLast(120)), (snapshot) => updateHistory(snapshot.val()), (error) => {
      document.querySelector("#notice-text").textContent = `อ่านประวัติ Firebase ไม่สำเร็จ: ${error.message}`;
      document.querySelector("#notice").hidden = false;
    });
  } catch (error) {
    setConnection("error", "เชื่อมต่อไม่สำเร็จ");
    document.querySelector("#notice-text").textContent = `ตั้งค่า Firebase ไม่ถูกต้อง: ${error.message}`;
    document.querySelector("#notice").hidden = false;
  }
}