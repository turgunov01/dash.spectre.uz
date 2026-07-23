# ТЗ для фронтенда — подключение админки Spectre

Документ для фронтенд-разработчика: как интегрировать админ-панель (Nuxt 3 / любой SPA) с backend-API Spectre.

- **Base URL:** `http://<host>:3000`
- **API-префикс:** все методы под `/api/v1` (кроме статики `/uploads/*`)
- **Формат:** JSON. Тело запроса — `Content-Type: application/json` (кроме загрузки файлов — `multipart/form-data`).
- **Живая карта эндпоинтов:** `GET /api/v1/` (возвращает список групп и путей).

---

## 1. Соглашения об ответах

**Успех** — всегда объект с полем `data` (иногда доп. поля вроде `count`, `unreadCount`):
```json
{ "data": { ... } }        // объект
{ "data": [ ... ] }        // список
{ "data": [...], "count": 12 }
```

**Ошибка** — единый конверт:
```json
{ "error": { "status": 409, "code": "CONFLICT", "message": "insufficient stock: have 48, need 100", "details": [ ... ] } }
```
`details` присутствует только у ошибок валидации (`code: "VALIDATION"`) — массив `{ path, message }`.

**HTTP-коды:** `200/201` ок · `400` валидация/битый параметр · `401` нет/просрочен токен · `403` недостаточно роли · `404` не найдено · `409` конфликт бизнес-правил · `429` слишком много попыток · `500` внутренняя. **502 backend не отдаёт.**

**Типы данных:**
- Денежные и количественные поля приходят **числами** (не строками): `total: 373000`. Валюта — сум, без копеек в UI по желанию.
- Даты — ISO-строки UTC: `"2026-07-13T00:38:16.580Z"`.
- `id` — целые числа.
- Кириллицу в query-параметрах **обязательно URL-кодировать** (`?q=%D0%9C%D0%BE%D0%B9%D0%BA%D0%B0`), иначе 400 от HTTP-парсера.

**Пагинация:** сейчас списки отдают последние N (100–300) записей с фильтрами через query. Offset/cursor-пагинации пока нет — если нужна, скажите бэкенду.

---

## 2. Аутентификация (JWT)

### Модель токенов
- **accessToken** — JWT, живёт **15 минут**. Слать в каждом защищённом запросе: `Authorization: Bearer <accessToken>`.
- **refreshToken** — непрозрачная строка, живёт 30 дней. **Ротируется**: после `/auth/refresh` старый refresh становится невалидным, приходит новый — сохраните его.
- Rate-limit на `/auth/login` и `/auth/refresh`: **10 попыток / 15 мин / IP** → при превышении `429`.

### Где хранить (рекомендация)
- Web-админка: accessToken — в памяти (Pinia/стор); refreshToken — в `httpOnly`-cookie невозможно (бэкенд отдаёт в теле), поэтому храните refreshToken в `localStorage` **или** договоритесь с бэкендом о cookie-режиме. Access — только в памяти, не в localStorage (XSS).

### Флоу
```
POST /auth/login { email, password }
  → { accessToken, refreshToken, user: { id, email, name, role } }

# при 401 на любом запросе:
POST /auth/refresh { refreshToken }
  → { accessToken, refreshToken, user }   // сохранить ОБА токена

POST /auth/logout { refreshToken }   → { data: { loggedOut: true } }
GET  /auth/me                        → { data: { id, email, name, role } }
```

### Пример axios-интерцептора
```ts
api.interceptors.request.use((c) => {
  if (access) c.headers.Authorization = `Bearer ${access}`;
  return c;
});
api.interceptors.response.use(null, async (err) => {
  if (err.response?.status === 401 && refresh && !err.config._retry) {
    err.config._retry = true;
    const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken: refresh });
    access = data.accessToken; refresh = data.refreshToken;      // ротация!
    err.config.headers.Authorization = `Bearer ${access}`;
    return api(err.config);
  }
  throw err;
});
```

### Создание сотрудников
`POST /auth/register` (**только ADMIN/OWNER**) `{ email, password(min 8), name?, role? }` → `{ data: user }`.

---

## 3. Роли и матрица доступа

Роли: **OWNER · ADMIN · CASHIER · WASHER · BARTENDER · ACCOUNTANT**.
**OWNER всегда проходит любую проверку** (полный доступ). Ниже — какие роли допускаются к записи; чтение (GET) в большинстве модулей доступно любому авторизованному.

| Действие | Разрешённые роли (+OWNER) |
|---|---|
| Справочники: типы кузова, услуги, цены, пакеты | ADMIN |
| Клиенты/авто (создание/правка) | ADMIN, CASHIER, WASHER |
| Клиенты/авто (удаление) | ADMIN |
| Заказы: создать, статус, позиции | ADMIN, CASHIER, WASHER |
| Заказ: ручное назначение / авто-назначение мойщика | ADMIN |
| Заказ: «взять себе» (take) | WASHER |
| Касса: открыть/закрыть, оплата заказа | CASHIER, ADMIN |
| Касса: внести/изъять деньги | ADMIN |
| Возврат по заказу | ADMIN |
| Скидки (CRUD) | ADMIN |
| Применить/снять скидку на заказ | ADMIN, CASHIER |
| Меню/бар (CRUD, бар-продажа) | ADMIN, CASHIER, BARTENDER |
| Склад, партии, списания, рецептуры | ADMIN, BARTENDER |
| Закупки: создать/submit/purchased/receive, поставщики | ADMIN, BARTENDER |
| Закупки: approve/reject/fund/close | ADMIN |
| Логи: изменение | ADMIN |
| Отчёты `/reports/daily` | ACCOUNTANT, ADMIN |
| Дашборд `/stats/dashboard` | ACCOUNTANT, ADMIN, CASHIER |
| Резервная копия `/admin/backup` | OWNER |

> В UI прячьте кнопки по роли из `user.role`, но помните: **финальную проверку делает бэкенд** (вернёт 403). Не полагайтесь только на скрытие.

---

## 4. Живая очередь — Socket.IO (real-time)

Библиотека: `socket.io-client`. Два namespace.

```ts
import { io } from 'socket.io-client';

// Внутренняя очередь (для ERP-экранов) — нужен accessToken
const internal = io('http://host:3000/internal', { auth: { token: access } });
internal.on('queue:snapshot', (orders) => { /* массив заказов с position, waitSec, items, ... */ });
internal.on('connect_error', (e) => { /* невалидный/протухший токен */ });

// Публичная очередь (табло для клиентов) — без авторизации
const pub = io('http://host:3000/public');
pub.on('queue:snapshot', (rows) => { /* [{ orderId, plate, status, position }] */ });
```

- При подключении сразу приходит текущий снапшот. Далее `queue:snapshot` шлётся при каждом изменении заказа (создание, статус, назначение, оплата, скидка, позиции).
- **Публичный снапшот содержит ТОЛЬКО** `orderId, plate, status, position` — никаких имён/сумм/телефонов (приватность §14).
- Внутренний снапшот — полные заказы + `position` (порядковый) + `waitSec` (секунд ожидания).
- В очереди только статусы `NEW…READY`; после `DELIVERED/COMPLETED/CANCELLED` заказ исчезает.
- REST-дубликаты снапшота: `GET /queue` (внутр., авториз.), `GET /public/queue` (без авториз.).

---

## 5. Справочные enum'ы (для селектов/бейджей)

```ts
Role          = OWNER | ADMIN | CASHIER | WASHER | BARTENDER | ACCOUNTANT
OrderStatus   = NEW | QUEUED | ASSIGNED | IN_PROGRESS | AWAITING_PAYMENT | PAID | READY | DELIVERED | COMPLETED | CANCELLED
PaymentMethod = CASH | CARD | CLICK | PAYME
DiscountType  = PERCENT | FIXED | PERSONAL | PROMO | CERTIFICATE | PROMOTION | PACKAGE
DiscountStatus= ACTIVE | BLOCKED | USED
PurchaseStatus= DRAFT | CREATED | SUBMITTED | APPROVED | REJECTED | FUNDED | PURCHASED | RECEIVED | CLOSED
StockReason   = PURCHASE | WASH | SPOILAGE | EXPIRY | RECIPE | SALE | ADJUST | MANUAL
CashOpType    = SALE | REFUND | PURCHASE | DEPOSIT | WITHDRAWAL
NotifLevel    = INFO | WARN | CRITICAL
```

**Разрешённые переходы статуса заказа** (для показа доступных кнопок):
```
NEW → QUEUED, ASSIGNED, CANCELLED
QUEUED → ASSIGNED, IN_PROGRESS, CANCELLED
ASSIGNED → IN_PROGRESS, QUEUED, CANCELLED
IN_PROGRESS → AWAITING_PAYMENT, CANCELLED
AWAITING_PAYMENT → PAID, CANCELLED
PAID → READY, CANCELLED
READY → DELIVERED
DELIVERED → COMPLETED
COMPLETED / CANCELLED → (терминальные)
```
Нелегальный переход → `409`. `PAID` ставится **только** через `/orders/:id/pay`, не через `/status`.

---

## 6. Эндпоинты по модулям

> Ниже — методы, пути, тела и что возвращают. `(ADMIN)` и т.п. — требуемые роли (OWNER всегда ок). Все пути с префиксом `/api/v1`.

### 6.1 Справочники мойки
```
GET    /body-types?active=true
GET    /body-types/:id
POST   /body-types            (ADMIN)  { name, sortOrder?, isActive? }
PATCH  /body-types/:id        (ADMIN)
DELETE /body-types/:id        (ADMIN)

GET    /service-categories
POST   /service-categories    (ADMIN)  { name, sortOrder? }
PATCH/DELETE /service-categories/:id (ADMIN)

GET    /services?category_id=&active=true      // с ценами по кузовам + категорией
GET    /services/:id
GET    /services/:id/price?bodyTypeId=          → { data: { serviceId, bodyTypeId, price } }
POST   /services              (ADMIN)  { name, categoryId?, description?, durationMin?, prices?: [{bodyTypeId, price}] }
PATCH  /services/:id          (ADMIN)
PUT    /services/:id/prices   (ADMIN)  [{ bodyTypeId, price }, ...]   // upsert матрицы цен
DELETE /services/:id          (ADMIN)

GET    /packages?active=true                    // с услугами и скидками
GET    /packages/:id
GET    /packages/:id/price?bodyTypeId=          → { data: { base, discountPercent, total } }
POST   /packages              (ADMIN)  { name, description?, photoUrl?, serviceIds?: [], discounts?: [{bodyTypeId, discountPercent}] }
PATCH  /packages/:id          (ADMIN)
PUT    /packages/:id/services (ADMIN)  [serviceId, ...]
PUT    /packages/:id/discounts(ADMIN)  [{ bodyTypeId, discountPercent }]
DELETE /packages/:id          (ADMIN)
```

### 6.2 Клиенты и авто
```
GET    /clients?q=<имя|тел>                     // + _count.cars/_count.orders
GET    /clients/:id                             // + cars
POST   /clients               (ADMIN/CASHIER/WASHER)  { name, phone?, comment? }
PATCH  /clients/:id           (ADMIN/CASHIER/WASHER)
DELETE /clients/:id           (ADMIN)

GET    /cars?q=<госномер>&client_id=
GET    /cars/:id
POST   /cars                  (ADMIN/CASHIER/WASHER)  { plate, bodyTypeId, make?, model?, clientId?, comment? }
PATCH  /cars/:id              (ADMIN/CASHIER/WASHER)
DELETE /cars/:id              (ADMIN)
```

### 6.3 Заказы
```
GET    /orders?q=&status=&washer_id=&client_id=    // q ищет по номеру/госномеру/телефону/имени
GET    /orders/:id
POST   /orders               (ADMIN/CASHIER/WASHER)
       // вариант 1: по существующему авто (тип кузова/данные подтянутся):
       { carId, items: [{type:'SERVICE'|'PACKAGE', refId, qty?}], comment?, discountAmount? }
       // вариант 2: walk-in без carId:
       { bodyTypeId, plate, clientName?, phone?, make?, model?, items:[...] }
       → заказ с автоматически посчитанными subtotal/total, статус NEW
POST   /orders/:id/status    (ADMIN/CASHIER/WASHER)  { status, comment? }
POST   /orders/:id/assign    (ADMIN)         { washerId }      // ручное назначение
POST   /orders/:id/take      (WASHER)                          // мойщик берёт себе
POST   /orders/:id/assign-auto (ADMIN)                         // авто (наименее загруженный)
POST   /orders/:id/items     (ADMIN/CASHIER) [{type, refId, qty?}]   // добавить позиции
DELETE /orders/:id/items/:itemId (ADMIN/CASHIER)               // + пересчёт суммы
```

### 6.4 Касса, оплаты, возвраты
```
POST /cash/open              (CASHIER/ADMIN)     // openingBalance = остаток прошлого закрытия
POST /cash/close             (CASHIER/ADMIN)     → сессия с closingBalance, breakdown по методам
GET  /cash/current                               → { session, totals:{cashBalance, salesTotal, washTotal, barTotal, refundsTotal, purchasesTotal, breakdown} } | null
GET  /cash/sessions
GET  /cash/sessions/:id                          // + operations, payments, refunds
POST /cash/deposit           (ADMIN)  { amount, method?, comment? }
POST /cash/withdraw          (ADMIN)  { amount, method?, comment(required) }

POST /orders/:id/pay         (CASHIER/ADMIN)  { method }   // только из AWAITING_PAYMENT; ставит PAID; нужна открытая касса
POST /orders/:id/refund      (ADMIN)          { amount, method, reason(required), items?: [{orderItemId, amount}] }  // частичный
```
> Оплата/возврат/операции кассы **неизменяемы** — эндпоинтов PATCH/DELETE у них нет by design.

### 6.5 Скидки
```
GET    /discounts?type=&status=&client_id=&code=
GET    /discounts/:id
POST   /discounts            (ADMIN)  { name, type, value, code?, clientId?, startsAt?, endsAt?, oneTime?, reason? }
                                       // value: для FIXED — сумма; для остальных — процент (0..100)
PATCH  /discounts/:id        (ADMIN)  // + можно менять status
DELETE /discounts/:id        (ADMIN)

POST   /orders/:id/discount  (ADMIN/CASHIER)  { discountId } | { code }   // применяет, пересчитывает total, oneTime→USED
DELETE /orders/:id/discount  (ADMIN/CASHIER)                              // снимает
```
> Скидки **не суммируются** — применение заменяет предыдущую. Просроченная авто-переводится в `BLOCKED`.

### 6.6 Digital-меню и бар
```
GET    /public/menu                              // БЕЗ авторизации — для сайта/табло; «нет в наличии» не скрывается
GET    /menu-categories
POST/PATCH/DELETE /menu-categories[/:id]   (ADMIN/CASHIER/BARTENDER)
GET    /menu-items?category_id=                  // + variants
GET    /menu-items/:id
POST   /menu-items           (ADMIN/CASHIER/BARTENDER)
       { name, categoryId?, description?, composition?, photoUrl?, volume?, weight?, price?,
         isAvailable?, isPublished?, markHit?, markNew?, markPromo?, variants?: [{name, price, volume?, weight?}] }
PATCH  /menu-items/:id       (…)
DELETE /menu-items/:id       (…)
POST   /menu-items/:id/variants  (…)  { name, price, volume?, weight? }
PATCH/DELETE /menu-variants/:id  (…)

POST   /bar/sale             (CASHIER/BARTENDER/ADMIN)  { method, items:[{itemId, variantId?, qty?}] }
                                       // нужна открытая касса; авто-списывает рецептуру; source=BAR
GET    /bar/sales?session_id=
```

### 6.7 Склад (партии, FEFO)
```
GET    /stock-categories
POST   /stock-categories     (ADMIN/BARTENDER)  { name }
GET    /stock-items?q=&low=true                  // + lowStock:boolean
GET    /stock-items/:id                          // + batches (активные), movements
POST   /stock-items          (ADMIN/BARTENDER)  { name, categoryId?, unit?, minQty? }
PATCH  /stock-items/:id      (ADMIN/BARTENDER)
POST   /stock-items/:id/receive  (ADMIN/BARTENDER)  { qty, expiresAt?, note? }   // новая партия (IN)
POST   /stock-items/:id/writeoff (ADMIN/BARTENDER)  { qty, reason, comment?, photoUrl? }  // FEFO OUT
GET    /stock/low                                // позиции ≤ минимума
GET    /stock/expiring?days=7                    // партии с истекающим сроком
GET    /stock/movements?stock_item_id=
```

### 6.8 Рецептуры
```
GET /menu-items/:id/recipe
PUT /menu-items/:id/recipe    (ADMIN/BARTENDER)  { ingredients: [{ stockItemId, qty }] }
GET /menu-variants/:id/recipe
PUT /menu-variants/:id/recipe (ADMIN/BARTENDER)  { ingredients: [...] }
DELETE /recipes/:id           (ADMIN/BARTENDER)
```

### 6.9 Закупки и поставщики
```
GET    /suppliers
POST   /suppliers            (ADMIN/BARTENDER)  { name, phone?, comment? }
PATCH  /suppliers/:id        (ADMIN/BARTENDER)

GET    /purchases?status=
GET    /purchases/:id
POST   /purchases            (ADMIN/BARTENDER)  { supplierId?, reason?, comment?, items:[{name, stockItemId?, unit?, qty, estPrice}] }
POST   /purchases/:id/submit    (ADMIN/BARTENDER)  → SUBMITTED
POST   /purchases/:id/approve   (ADMIN)            → APPROVED
POST   /purchases/:id/reject    (ADMIN)            → REJECTED
POST   /purchases/:id/fund      (ADMIN)            → FUNDED (списывает estimatedTotal из открытой кассы)
POST   /purchases/:id/purchased (ADMIN/BARTENDER)  { items:[{purchaseItemId, actualPrice, actualQty, expiresAt?, photoUrl?}] } → PURCHASED
POST   /purchases/:id/receive   (ADMIN/BARTENDER)  → RECEIVED (создаёт партии на складе)
POST   /purchases/:id/close     (ADMIN)            → CLOSED (возвращает остаток в кассу)
```
Кнопки перехода показывайте по текущему `status` (см. цепочку в §5-аналоге закупок: CREATED→SUBMITTED→APPROVED→FUNDED→PURCHASED→RECEIVED→CLOSED, ветка SUBMITTED→REJECTED).

### 6.10 Уведомления, отчёты, файлы
```
GET  /notifications?unread=true&type=     → { data:[...], unreadCount }
POST /notifications/:id/read
POST /notifications/read-all
POST /telegram/register       { chatId, label? }
GET  /telegram/users          (ADMIN)

GET  /reports/daily?date=YYYY-MM-DD   (ACCOUNTANT/ADMIN)   // financial/wash/bar/warehouse + топы
GET  /stats/dashboard         (ACCOUNTANT/ADMIN/CASHIER)   // касса, оборот, счётчики очереди, low-stock и т.д.

GET  /logs?entity=&action=&level=&limit=

POST /files                   (multipart, поле "file")  → { data:{ url, filename, size, mime } }
POST /admin/backup            (OWNER)
```

---

## 7. Загрузка файлов
```ts
const fd = new FormData();
fd.append('file', file);   // image/jpeg|png|webp или application/pdf, ≤ 5 МБ
const { data } = await api.post('/api/v1/files', fd);  // multipart; Authorization обязателен
// data.url = "/uploads/<uuid>.png" → показывать как `${baseUrl}${data.url}`
```
Отклонённый тип/размер → `400 { code: "UPLOAD_REJECTED" }`. Полученный `url` кладите в `photoUrl` товара/позиции меню/чека.

---

## 8. Рекомендуемая структура админки (экраны по ролям)

- **Дашборд** (owner/admin/accountant/cashier) — `/stats/dashboard`: касса, оборот за день, счётчики очереди, low-stock, активные закупки.
- **Живая очередь** (все) — Socket.IO `/internal`, карточки заказов по статусам (канбан), кнопки перехода/назначения.
- **Рабочее место кассира** (cashier) — быстрый заказ, оплата, бар-продажа, открыть/закрыть кассу.
- **Рабочее место мойщика** (washer) — доступные заказы (`?status=QUEUED`), «взять», смена статуса.
- **Рабочее место бармена** (bartender) — меню, склад, рецептуры, закупки, списания, уведомления.
- **Кабинет бухгалтера** (accountant) — `/reports/daily`, история кассы, закупки, возвраты.
- **Справочники** (admin/owner) — типы кузова, услуги+цены, пакеты, меню, скидки, сотрудники (`/auth/register`), поставщики.
- **Заказы**, **Клиенты/авто**, **Склад/партии**, **Закупки**, **Отчёты**, **Уведомления**, **Журнал действий**.
- **Публичное табло** (без авторизации) — Socket.IO `/public` + `/public/menu`.

---

## 9. Готовые сценарии

**Оформить и оплатить заказ:**
```
POST /orders {carId, items:[{type:'SERVICE',refId:1},{type:'PACKAGE',refId:1}]}   // → NEW, total
POST /orders/:id/discount {code:'SPRING'}                 // (опц.) скидка
POST /orders/:id/status {status:'QUEUED'} → ... → {status:'AWAITING_PAYMENT'}
POST /cash/open                                            // если касса закрыта
POST /orders/:id/pay {method:'CASH'}                       // → PAID
POST /orders/:id/status {status:'READY'} → {status:'DELIVERED'} → {status:'COMPLETED'}
```

**Бар-продажа:** `POST /cash/open` → `POST /bar/sale {method, items:[{itemId, variantId?, qty}]}` (рецептура спишет ингредиенты; если не хватает — `409`, продажа не пройдёт).

**Закупка:** `POST /purchases` → `submit` → `approve` → `fund` (деньги из кассы) → `purchased` (факт) → `receive` (на склад) → `close` (возврат остатка).

---

## 10. Открытые вопросы к бэкенду (уточнить перед стартом)
1. Режим хранения refreshToken: тело (сейчас) vs `httpOnly`-cookie — скажите, если нужен cookie-режим.
2. **CORS включён** (REST + Socket.IO). В dev — `*`; для прода задайте `CORS_ORIGIN` в `.env` (например `https://admin.spectre.uz`). `credentials: true` поддержан.
3. Пагинация (offset/cursor) в больших списках — по запросу.
4. Swagger/OpenAPI — по запросу можно сгенерировать.
5. Telegram-уведомления активны только при заданном `TELEGRAM_BOT_TOKEN`.
