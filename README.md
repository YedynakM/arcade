# Аркада

Локальний сайт-обгортка для міні-ігор. Сервер: Node.js 18+, Express. Клієнт: ES-модулі без збірки.

## Встановлення

```bash
cd arcade
npm install
```

## Запуск

```bash
npm start
```

Сайт відкриється за адресою http://localhost:3000.

Windows PowerShell: якщо `npm` блокується політикою виконання скриптів, використовуйте `npm.cmd`:

```powershell
npm.cmd install
npm.cmd start
```

Змінна середовища `JWT_SECRET` задає секрет токенів (необов'язково); `PORT` задає порт.

## Демо-дані

```bash
npm run seed
```

Створює 8 демо-гравців з партіями за останні 7 днів. Повторний запуск дублікатів не створює. Для PowerShell: `npm.cmd run seed`.

## Логіни

| Роль | Логін | Пароль |
|------|-------|--------|
| Адміністратор | admin | admin123 |
| Демо-гравці | demo_olena, demo_taras, demo_marichka, demo_bohdan, demo_solomiya, demo_andriy, demo_ivanka, demo_yurko | demo123 |

Адміністратор створюється автоматично при першому запуску сервера.

## Сценарій демонстрації (5 кроків)

1. Виконати `npm run seed`, запустити `npm start`, відкрити головну сторінку: видно топ-3, кількість гравців і гру дня.
2. Зареєструвати нового гравця або увійти як `demo_olena` / `demo123`, відкрити «Профіль» і змінити нік та аватар.
3. Відкрити каталог ігор, запустити доступну гру, завершити її: з'являться нараховані очки, тост і нові досягнення.
4. Відкрити «Таблицю лідерів» (загальну та по грі) і сторінку «Досягнення».
5. Увійти як `admin` / `admin123`, відкрити адмінку: змінити множники очок, вимкнути гру, заблокувати гравця, переглянути статистику та відгуки.

## Структура папок

```
arcade/
├── package.json
├── README.md
├── server/
│   ├── server.js            запуск Express, статика, підключення маршрутів
│   ├── seed.js              демо-дані
│   ├── data/db.json         база даних (JSON)
│   ├── middleware/          requireAuth, requireAdmin, errorHandler
│   ├── routes/              auth, me, games, scores, leaderboard,
│   │                        achievements, feedback, summary, admin
│   └── services/            config, db, scoring, achievements, validate
└── client/
    ├── index.html
    ├── css/                 base, layout, components, animations, themes
    └── js/
        ├── app.js, router.js, api.js, auth.js
        ├── ui/              toast, modal, form, spinner, skeleton,
        │                    counter, background, theme
        ├── pages/           home, hub, game, leaderboard, profile,
        │                    achievements, about, admin, login, register
        └── games/           registry.js та файли ігор
```