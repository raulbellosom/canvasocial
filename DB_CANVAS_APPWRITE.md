# Configuración de Appwrite - Canvas Social (Figma-lite colaborativo)

Este documento describe la configuración completa de Appwrite para **Canvas Social**, una app tipo Figma/Illustrator-lite con colaboración en tiempo real.

> ✅ Sin `relation` attributes: todas las uniones son por IDs (strings) como llaves foráneas.
> ✅ Considera limitaciones Appwrite 1.8 RC2: **no usar default+required a la vez**, nombres de índices cortos, etc.

## 📋 Índice

1. [Configuración Inicial](#configuración-inicial)
2. [Autenticación](#autenticación)
3. [Base de Datos](#base-de-datos)
4. [Storage](#storage)
5. [Funciones](#funciones)
6. [Variables de Entorno](#variables-de-entorno)

---

## 🚀 Configuración Inicial

### Instancia Self-Hosted

**URL de la instancia:** `https://appwrite.racoondevs.com`

### Crear Proyecto

1. Console → Crear proyecto: **"Canvas Social"**
2. Configurar plataforma Web:
   - **Name:** Canvas Social Web
   - **Hostname dev:** `*.appwrite.dev` (o el que uses)
   - **Hostname prod:** tu dominio final

---

## 🔐 Autenticación

### Configuración Auth

- ✅ Email/Password
- (Opcional) ✅ OAuth después
- Recomendado:
  - Max sessions per user: 10
  - Session length: 365 days

### Perfil extendido

Después de crear usuario en Auth, crear/actualizar su perfil en la colección `profiles` usando `user_auth_id = $id`.

---

## 🗄️ Base de Datos

### Estructura General

- **Database Name:** `canvas_social_db`
- **Database ID:** `canvas_social_db`

### Convenciones

- Colecciones/fields: `snake_case`
- Enums: `SCREAMING_SNAKE_CASE`
- Índices:
  - Unique: `uq_[col]_[field]`
  - Key: `idx_[col]_[field]`
  - Fulltext: `idx_[col]_[field]`

---

## 📊 Colecciones y Atributos

### 1️⃣ profiles

Perfil extendido vinculado a Appwrite Auth.

#### Attributes

| Field          | Type    | Size | Required | Default | Array |
| -------------- | ------- | ---: | :------: | ------- | :---: |
| user_auth_id   | String  |   64 |    ✅    |         |  ❌   |
| email          | String  |  254 |    ✅    |         |  ❌   |
| name           | String  |  120 |    ✅    |         |  ❌   |
| avatar_file_id | String  |   64 |    ❌    |         |  ❌   |
| enabled        | Boolean |    - |    ❌    | true    |  ❌   |

> ⚠️ Nota: si `enabled` tiene default `true`, **NO** lo marques required en Appwrite.

#### Indexes

| Name                 | Type   | Attributes     |
| -------------------- | ------ | -------------- |
| uq_profiles_userauth | unique | user_auth_id ↑ |
| uq_profiles_email    | unique | email ↑        |
| idx_profiles_enabled | key    | enabled ↑      |

---

### 2️⃣ workspaces

Contenedor principal de colaboración.

#### Attributes

| Field    | Type    | Size | Required | Default | Array |
| -------- | ------- | ---: | :------: | ------- | :---: |
| name     | String  |  120 |    ✅    |         |  ❌   |
| owner_id | String  |   64 |    ✅    |         |  ❌   |
| enabled  | Boolean |    - |    ❌    | true    |  ❌   |

#### Indexes

| Name                 | Type | Attributes |
| -------------------- | ---- | ---------- |
| idx_workspaces_name  | key  | name ↑     |
| idx_workspaces_owner | key  | owner_id ↑ |
| idx_workspaces_en    | key  | enabled ↑  |

---

### 3️⃣ workspace_members

Membresías por workspace (owner/editor/viewer).

#### Attributes

| Field        | Type    | Size | Required | Default | Array |
| ------------ | ------- | ---: | :------: | ------- | :---: |
| workspace_id | String  |   64 |    ✅    |         |  ❌   |
| user_id      | String  |   64 |    ✅    |         |  ❌   |
| role         | Enum    |    - |    ✅    |         |  ❌   |
| invited_by   | String  |   64 |    ❌    |         |  ❌   |
| enabled      | Boolean |    - |    ❌    | true    |  ❌   |

#### Enums

**role:**

- `OWNER`
- `EDITOR`
- `VIEWER`

#### Indexes

| Name           | Type   | Attributes                |
| -------------- | ------ | ------------------------- |
| uq_wsm_ws_user | unique | workspace_id ↑, user_id ↑ |
| idx_wsm_ws     | key    | workspace_id ↑            |
| idx_wsm_user   | key    | user_id ↑                 |
| idx_wsm_role   | key    | role ↑                    |
| idx_wsm_en     | key    | enabled ↑                 |

---

### 4️⃣ canvases

Proyecto de canvas dentro de un workspace.

#### Attributes

| Field            | Type    | Size | Required | Default | Array |
| ---------------- | ------- | ---: | :------: | ------- | :---: |
| workspace_id     | String  |   64 |    ✅    |         |  ❌   |
| name             | String  |  140 |    ✅    |         |  ❌   |
| created_by       | String  |   64 |    ✅    |         |  ❌   |
| snapshot_file_id | String  |   64 |    ❌    |         |  ❌   |
| canvas_json      | String  | 2000 |    ✅    |         |  ❌   |
| width            | Integer |    - |    ❌    | 1280    |  ❌   |
| height           | Integer |    - |    ❌    | 720     |  ❌   |
| bg_color         | String  |    7 |    ❌    | #ffffff |  ❌   |
| bg_file_id       | String  |   64 |    ❌    |         |  ❌   |
| is_public        | Boolean |    - |    ❌    | false   |  ❌   |
| enabled          | Boolean |    - |    ❌    | true    |  ❌   |

> Nota: `canvas_json` es string (JSON). Mantén el tamaño contenido (MVP).
> Para canvases grandes, guarda objetos por separado (ej. `canvas_objects`) o usa snapshots/versionado.

#### Indexes

| Name                | Type | Attributes     |
| ------------------- | ---- | -------------- |
| idx_canv_ws         | key  | workspace_id ↑ |
| idx_canv_created_by | key  | created_by ↑   |
| idx_canv_public     | key  | is_public ↑    |
| idx_canv_enabled    | key  | enabled ↑      |
| idx_canv_updated    | key  | $updatedAt ↓   |

---

### 5️⃣ canvas_members

Membresías a nivel canvas (por si quieres permisos distintos al workspace).

#### Attributes

| Field     | Type    | Size | Required | Default | Array |
| --------- | ------- | ---: | :------: | ------- | :---: |
| canvas_id | String  |   64 |    ✅    |         |  ❌   |
| user_id   | String  |   64 |    ✅    |         |  ❌   |
| role      | Enum    |    - |    ✅    |         |  ❌   |
| enabled   | Boolean |    - |    ❌    | true    |  ❌   |

#### Enums

**role:**

- `OWNER`
- `EDITOR`
- `VIEWER`

#### Indexes

| Name                | Type   | Attributes             |
| ------------------- | ------ | ---------------------- |
| uq_cmem_canvas_user | unique | canvas_id ↑, user_id ↑ |
| idx_cmem_canvas     | key    | canvas_id ↑            |
| idx_cmem_user       | key    | user_id ↑              |
| idx_cmem_role       | key    | role ↑                 |
| idx_cmem_en         | key    | enabled ↑              |

---

### 6️⃣ canvas_ops

Operaciones del canvas (event sourcing ligero) para colaboración en tiempo real.

#### Attributes

| Field        | Type     | Size | Required | Default | Array |
| ------------ | -------- | ---: | :------: | ------- | :---: |
| canvas_id    | String   |   64 |    ✅    |         |  ❌   |
| op_type      | Enum     |    - |    ✅    |         |  ❌   |
| object_id    | String   |   64 |    ❌    |         |  ❌   |
| payload_json | String   | 5000 |    ✅    |         |  ❌   |
| actor_id     | String   |   64 |    ✅    |         |  ❌   |
| ts           | Datetime |    - |    ✅    |         |  ❌   |
| enabled      | Boolean  |    - |    ❌    | true    |  ❌   |

#### Enums

**op_type:**

- `add`
- `update`
- `delete`
- `reorder`
- `meta`

> **Payload JSON Structure:**
>
> - Para objetos normales: `{ "type": "object", "object": { ...data } }` o `{ "type": "object", "patch": { ... } }`
> - Para capas (Layers): `{ "type": "layer", "layer": { ...data }, "patch": { ... } }`
>
> La distinción se hace dentro del `payload_json` con la propiedad `type: "layer" | "object"`.

#### Indexes

| Name           | Type | Attributes  |
| -------------- | ---- | ----------- |
| idx_ops_canvas | key  | canvas_id ↑ |
| idx_ops_actor  | key  | actor_id ↑  |
| idx_ops_type   | key  | op_type ↑   |
| idx_ops_ts     | key  | ts ↑        |
| idx_ops_en     | key  | enabled ↑   |

---

### 7️⃣ canvas_sessions

Presence (quién está dentro del canvas). Se refresca con heartbeat.

#### Attributes

| Field     | Type     | Size | Required | Default | Array |
| --------- | -------- | ---: | :------: | ------- | :---: |
| canvas_id | String   |   64 |    ✅    |         |  ❌   |
| user_id   | String   |   64 |    ✅    |         |  ❌   |
| last_seen | Datetime |    - |    ✅    |         |  ❌   |
| device    | Enum     |    - |    ❌    |         |  ❌   |
| enabled   | Boolean  |    - |    ❌    | true    |  ❌   |

#### Enums

**device:**

- `MOBILE`
- `DESKTOP`
- `TABLET`
- `UNKNOWN`

#### Indexes

| Name                | Type   | Attributes             |
| ------------------- | ------ | ---------------------- |
| uq_sess_canvas_user | unique | canvas_id ↑, user_id ↑ |
| idx_sess_canvas     | key    | canvas_id ↑            |
| idx_sess_last_seen  | key    | last_seen ↓            |
| idx_sess_en         | key    | enabled ↑              |

---

### 8️⃣ invitations

Invitaciones a workspace o canvas, aceptables/declinables.

#### Attributes

| Field         | Type     | Size | Required | Default | Array |
| ------------- | -------- | ---: | :------: | ------- | :---: |
| target_type   | Enum     |    - |    ✅    |         |  ❌   |
| target_id     | String   |   64 |    ✅    |         |  ❌   |
| invitee_email | String   |  254 |    ✅    |         |  ❌   |
| invitee_user  | String   |   64 |    ❌    |         |  ❌   |
| role          | Enum     |    - |    ✅    |         |  ❌   |
| status        | Enum     |    - |    ✅    |         |  ❌   |
| invited_by    | String   |   64 |    ✅    |         |  ❌   |
| expires_at    | Datetime |    - |    ❌    |         |  ❌   |
| enabled       | Boolean  |    - |    ❌    | true    |  ❌   |

#### Enums

**target_type:**

- `WORKSPACE`
- `CANVAS`

**role:**

- `EDITOR`
- `VIEWER`

**status:**

- `PENDING`
- `ACCEPTED`
- `DECLINED`
- `EXPIRED`

#### Indexes

| Name            | Type | Attributes      |
| --------------- | ---- | --------------- |
| idx_inv_target  | key  | target_id ↑     |
| idx_inv_email   | key  | invitee_email ↑ |
| idx_inv_status  | key  | status ↑        |
| idx_inv_enabled | key  | enabled ↑       |

---

### 9️⃣ notifications

Centro de notificaciones in-app (invitaciones, actividad).

#### Attributes

| Field        | Type    | Size | Required | Default | Array |
| ------------ | ------- | ---: | :------: | ------- | :---: |
| user_id      | String  |   64 |    ✅    |         |  ❌   |
| type         | Enum    |    - |    ✅    |         |  ❌   |
| title        | String  |  180 |    ✅    |         |  ❌   |
| body         | String  | 2000 |    ❌    |         |  ❌   |
| payload_json | String  | 5000 |    ❌    |         |  ❌   |
| is_read      | Boolean |    - |    ❌    | false   |  ❌   |
| enabled      | Boolean |    - |    ❌    | true    |  ❌   |

#### Enums

**type:**

- `INVITE`
- `SYSTEM`
- `CANVAS_ACTIVITY`

#### Indexes

| Name              | Type | Attributes   |
| ----------------- | ---- | ------------ |
| idx_notif_user    | key  | user_id ↑    |
| idx_notif_read    | key  | is_read ↑    |
| idx_notif_enabled | key  | enabled ↑    |
| idx_notif_created | key  | $createdAt ↓ |

---

## 📦 Storage

### Buckets

#### 1. `avatars`

- **Max File Size:** 2 MB
- **Allowed Extensions:** jpg, jpeg, png, webp
- **Compression:** Enabled
- **Permissions:** Read/Create/Update/Delete: Users (own)

#### 2. `canvas_assets`

Imágenes subidas para insertar en canvas.

- **Max File Size:** 10 MB
- **Allowed Extensions:** jpg, jpeg, png, webp, svg
- **Compression:** Enabled

#### 3. `canvas_snapshots`

Snapshots (PNG) del canvas (para previews).

- **Max File Size:** 5 MB
- **Allowed Extensions:** png, jpg
- **Compression:** Enabled

---

## ⚙️ Funciones (Appwrite Functions)

> MVP puede funcionar sin Functions, pero para producción recomiendo funciones para:

- `invite-create` (validar permisos y crear invitation + notification)
- `invite-respond` (aceptar/declinar y crear membership de forma atómica)
- `presence-heartbeat` (opcional)
- `cleanup-ops` (limpieza programada de ops viejas)

---

## 🔑 Variables de Entorno

Ver `.env.example` en el repositorio.
