# Greenhouse 01 · IoT-106

แดชบอร์ดติดตามโรงเรือนแบบเรียลไทม์ ใช้ ESP32/ESPHome สุ่มค่าจำลอง 6 รายการ ส่งไป Firebase Realtime Database และแสดงข้อมูลล่าสุดพร้อมกราฟประวัติบน GitHub Pages

## ข้อมูลที่ส่ง

`temperature` (°C), `humidity` (%), `co2` (ppm), `light` (lux), `soil_moisture` (%) และ `battery` (V) พร้อม `device_id` และ Unix timestamp ทุก 10 วินาที

เส้นทางฐานข้อมูล:

```text
iot-106/
└── lab/
	└── esp32/
		├── latest/    ค่าล่าสุดจาก ESP32
		└── history/   ประวัติรายการแบบเพิ่มต่อเนื่อง
```

## ตั้งค่า Firebase

1. สร้าง Firebase project ชื่อ `iot-106` และเปิด Realtime Database ในโหมด locked.
2. คัดลอก URL ที่แสดงในหน้า Realtime Database; รูปแบบขึ้นกับ region ของฐานข้อมูล อย่าคาดเดาจากชื่อ project.
3. นำกฎจาก `database.rules.json` ไปวางในหน้า Realtime Database → Rules แล้วกด Publish.
4. ลงทะเบียน Web App ใน Project settings แล้วคัดลอก `apiKey`, `authDomain`, `databaseURL`, `projectId` และ `appId` ไปแทนค่าใน `firebase-config.js`.

กฎตัวอย่างนี้เปิดให้อ่านข้อมูลได้สาธารณะเพื่อให้ GitHub Pages แสดงผล และเปิดเขียนเฉพาะ `lab/esp32/latest`/`lab/esp32/history` โดยตรวจว่ามีฟิลด์เซนเซอร์ครบ กฎนี้เหมาะกับงานสาธิตเท่านั้น: ผู้ใช้ทั่วไปยังเขียนทับ/เพิ่มข้อมูลได้ จึงห้ามนำไปใช้กับข้อมูลสำคัญหรือ production.

## ตั้งค่าและแฟลช ESP32

1. ติดตั้ง ESPHome และสร้างไฟล์ `esphome/secrets.yaml` จาก `esphome/secrets.yaml.example`.
2. กรอก Wi-Fi, รหัสผ่าน และ URL แบบเต็มของ RTDB โดยเติม `/lab/esp32/latest.json` และ `/lab/esp32/history.json` ท้าย URL ตามตัวอย่าง.
3. สร้าง API encryption key ด้วย `esphome wizard` หรือ `openssl rand -base64 32`; ตั้งรหัสผ่าน OTA และ fallback AP ของตนเอง.
4. ตรวจและแฟลช config: `esphome run esphome/iot-106.yaml`.
5. เมื่อเวลา SNTP พร้อม บอร์ดจะสุ่มและส่งข้อมูลทุก 10 วินาที; เปิด ESPHome logs เพื่อตรวจ `Firebase latest updated` และ `Firebase history appended`.

## เผยแพร่ Dashboard

1. สร้าง GitHub repository ชื่อ `freeboard` และ push เนื้อหาโฟลเดอร์นี้ไปที่ root ของ repository.
2. ไปที่ Settings → Pages เลือก deploy จาก branch `main`, folder `/ (root)`.
3. ส่ง URL รูปแบบ `https://<ชื่อผู้ใช้>.github.io/freeboard` ตามตัวอย่างโจทย์.

ก่อนส่งงาน ให้เปิด Dashboard และตรวจว่าขึ้น `รับข้อมูลสด`, ค่าทั้ง 6 รายการ และกราฟประวัติเพิ่มขึ้นจริง หากเห็นข้อความ `ยังไม่พบข้อมูลใน lab/esp32/latest` ให้ตรวจ URL/Rules, secret URLs และ log ของ ESPHome.