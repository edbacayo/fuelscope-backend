# FuelScope
**Zoom in on fuel & maintenance data.**

FuelScope is a vehicle management app designed to help users track fuel expenses, monitor maintenance history, and visualize driving efficiency across multiple vehicles. Whether you’re managing one car or a small fleet, FuelScope helps keep your vehicle records in one place—accessible and actionable.

---

## 🚀 Features

- Fuel cost and consumption tracking with charts
- Service reminders and maintenance logs
- Manage multiple vehicles
- Secure login with role-based access (User/Admin)
- Admin Panel to manage users, service types, and fuel brands
- CSV import for fuel entries
- Filtering and date-based insights

---

## 🔑 Getting Started

### Requirements
- Node.js (v18 or above)
- npm

### Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/edmundbacayo/fuelscope.git
   cd fuelscope/backend

2. Install dependencies:
   ```bash
   npm install
    
3. Set up environment variables:
   ```bash
   cp .env.example .env
    
4. Start the development server:
   ```bash
   npm start

5. Open http://localhost:5000 in your browser.

## Navigation Overview
| Page               | Description                                   |
| ------------------ | --------------------------------------------- |
| `/login`           | User login screen                             |
| `/dashboard`       | Redirects to the first vehicle's dashboard    |
| `/dashboard/:id`   | View fuel and service stats for a vehicle     |
| `/manage-vehicles` | Add/edit/remove your vehicles                 |
| `/admin`           | Admin-only panel for managing global settings |

## Admin Capabilities
- Add/remove users
- Assign roles
- Set fuel brand presets
- Define service intervals

## Tech Stack
- React 19
- Bootstrap 5
- Recharts for charting
- Axios for API communication
- React Router v7

## Support
If you encounter bugs or want to suggest a feature, feel free to open an issue or contact the developer.

