<div align="center">
  <img src="./public/logo.png" alt="MikroMeter Logo" width="200" height="200" />

  <h1>MikroMeter</h1>
  <p><strong>Enterprise-Grade MikroTik Network Monitoring & Management Platform</strong></p>

  <p>
    <a href="https://github.com/your-username/mikrometer/actions"><img src="https://img.shields.io/github/actions/workflow/status/your-username/mikrometer/ci.yml?style=for-the-badge&logo=github&labelColor=000000" alt="Build Status" /></a>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-15.0-black?style=for-the-badge&logo=next.js" alt="Next.js" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0-black?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-black?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/your-username/mikrometer?style=for-the-badge&color=black" alt="License" /></a>
    <a href="https://github.com/your-username/mikrometer/stargazers"><img src="https://img.shields.io/github/stars/your-username/mikrometer?style=for-the-badge&color=black" alt="Stars" /></a>
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-documentation">Documentation</a> •
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

## ⚡ Overview

**MikroMeter** is a premium, self-hosted web dashboard meticulously crafted for managing and monitoring MikroTik RouterOS devices. Built for network engineers, ISPs, and sysadmins, it consolidates real-time analytics, automated backups, configuration auditing, and SLA metrics into a stunning dark glassmorphism UI.

Driven by Next.js and seamlessly integrated with modern AI workflows, MikroMeter scales from a single edge router to an entire enterprise fleet with zero external database dependencies.

<br />

<div align="center">
  <img src="https://placehold.co/1200x600/0f172a/38bdf8?text=MikroMeter+Dashboard+Preview&font=inter" alt="Dashboard Preview" width="100%" />
  <p><em>Real-time network telemetry, spatial router tracking, and advanced analytics in a unified dashboard.</em></p>
</div>

---

## ✨ Key Features

### 📊 Real-Time Telemetry & Monitoring
- **Live Bandwidth Metrics**: Sub-second polling of per-interface RX/TX charts with SVGs.
- **Hardware Utilization**: Monitor CPU, memory, and disk usage with historical trending.
- **Geospatial Mapping**: Interactive Leaflet maps tracking router geographic distribution.

### 🛠️ Advanced Router Management
- **Configuration Auditing**: Take timestamped snapshots of RouterOS configurations. Perform powerful `diff` operations to see exactly what changed, line-by-line.
- **Backup Automation**: One-click `.backup` and `.rsc` exports. Schedule automated backups with customizable retention policies.
- **Console Shell**: Fully-featured integrated SSH terminal emulator for direct CLI access from the browser.

### 🌐 Network Operations
- **DHCP & Top Talkers**: Real-time DHCP lease tables, bandwidth rankings, and instant IP blocking.
- **Routing Insights**: Monitor BGP session states, OSPF adjacencies, and navigate the full IP routing table with lightning-fast filtering.
- **Hotspot Manager**: Generate, manage, and print hotspot vouchers directly to MikroTik with defined data quotas and time limits.

### 🤖 AI-Powered Assistant & Alerting
- **Network Copilot**: Built-in AI assistant (supporting OpenAI, Ollama, and custom endpoints) to query network state, generate configuration scripts, or troubleshoot issues.
- **Intelligent Alerting**: Threshold-based alert rules automatically detect anomalies and outages, dispatching real-time notifications via **Telegram** and **WhatsApp**.
- **SLA Speedtests**: Schedule and track automated RouterOS speedtests to ensure bandwidth compliance.

---

## 🏗 Architecture & Tech Stack

MikroMeter is engineered for high performance, utilizing a modern, serverless-ready architecture. It stores all data as flat JSON files in a dedicated `data/` volume, ensuring zero database overhead and effortless backups.

* **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5
* **Styling**: Native CSS Variables (Custom Dark/Light Design System), Glassmorphism UI, Lucide Icons
* **Mapping**: Leaflet & React Leaflet
* **Backend Services**: Node.js `ssh2` client, custom JSON data store, automated background polling scheduler

---

## 🚀 Quick Start

### Prerequisites
* **Node.js** 18.x or higher (LTS recommended)
* A **MikroTik RouterOS** device (v6 or v7) with **SSH access** enabled
* *(Optional)* API keys for OpenAI, Telegram, or WhatsApp Webhooks

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/mikrometer.git
   cd mikrometer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   *The application will be available at [http://localhost:3000](http://localhost:3000).*

### Deployment (Production)

To build and run MikroMeter for production environments:

```bash
npm run build
npm start
```

*For Docker deployments, refer to our Docker Deployment Guide.*

---

## ⚙️ Configuration

No initial configuration files or environment variables are required. MikroMeter is entirely managed through its web UI.
Upon first launch, the `data/` directory is automatically scaffolded. 

1. Navigate to **Settings** in the web interface to configure notifications, auto-backup intervals, and AI providers.
2. Go to **Routers** and click **Add Router** to connect your first MikroTik device. The system will automatically verify SSH connectivity.
3. The internal scheduler instantly begins polling hardware metrics and processing alerts.

---

## 📚 API Reference

MikroMeter exposes a comprehensive RESTful API for external integrations. 

* `GET /api/routers` - Retrieve fleet status
* `GET /api/routers/:id/stats` - Fetch telemetry
* `POST /api/routers/:id/terminal` - Execute remote SSH commands
* `GET /api/config-audit/diff` - Generate configuration diffs programmatically

---

## 🤝 Contributing

We welcome contributions from the community! Whether you are fixing bugs, improving the documentation, or proposing new features, please review our Contribution Guidelines first.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🛡️ License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<div align="center">
  <p>Built with ❤️ for the MikroTik and Open-Source Community</p>
</div>
