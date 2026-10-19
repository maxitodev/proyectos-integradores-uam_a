<p align="right">
  <a href="./README.md">Español</a> | <b>English</b>
</p>
# Capstone Projects

Software Project Management (1151055) · UAM Azcapotzalco · 26-O

Instructor: M.Sc. Gabriel Hurtado Avilés

## Team

- Max Uriel Sánchez Díaz (2213026327)
- Daniela Nava Martínez (2223028762)
- Bryan Tonatiuh Ochoa De La Cruz (2223028771)

## Projects

1. **Classroom Navigation App** (Required): Augmented reality indoor navigation. User stories are tracked as issues on the team board.
2. **MP3 Music Player** (Custom project, built with Next.js and Supabase): Rationale for this choice can be found in [docs/eleccion.md](docs/eleccion.md), and the project proposal sheet in [docs/propuesta.md](docs/propuesta.md).

## Workflow

1. Every change begins with an issue.
2. Work is carried out in dedicated branches (`feat/whatever`), never directly on `main`.
3. Pull Requests must include `Closes #N`, require review by another team member, and need all CI checks passing green.
4. Each member creates and signs off on their own commits.

Do not commit `.env`. Any required environment variables must be declared in `.env.example`.

## How to Run

No code has been added yet. Once available, execution commands will be documented here.


## Differences Between Kotlin and Flutter
Below is a comparison between both technologies highlighting their key trade-offs when undertaking a project.

| Criteria | Flutter (Dart) | Kotlin (Jetpack Compose) |
|---|---|---|
| **Language** | Uses Dart: an object-oriented, strongly typed language with C/Java/JS-style syntax. Designed around two execution targets: a virtual machine featuring JIT compilation for rapid iteration during development, and AOT compilation for production builds. Concurrency relies on an event-driven model powered by an **event loop** and **Isolates**. | A modern, statically and strongly typed language blending object-oriented and functional paradigms. Features first-class null safety, concise syntax, and native interoperability with **Java** on **Android/JVM**, as well as direct Objective-C/Swift interop on iOS via Kotlin/Native. |
| **Shared Code** | • **API Consumption:** Interacts with a Node.js/Express REST API using standard HTTP requests and JWT authentication.<br>• **Unified UI & Business Logic:** 100% of the codebase (domain logic, models, networking, and UI) is shared across platforms via its custom rendering engine (Impeller/Skia). | • **API Consumption:** Connects to the same REST API endpoints using JWT authentication.<br>• **Decoupled Architecture:** User interfaces are implemented natively using Jetpack Compose on Android (and standalone SwiftUI on iOS if applicable). Business logic and networking can be shared if structured as a Kotlin Multiplatform (KMP) module. |
| **Compilation Time** | • **Development (Hot Reload):** Sub-second iteration enabled by Dart's JIT VM without losing application state.<br>• **Production:** Direct Ahead-Of-Time (AOT) compilation to native machine code.<br>• *Note:* Precise benchmarks across the development team remain to be recorded. | • **Development:** Fast iteration on Android via Compose Previews and Gradle incremental builds.<br>• **Production:** Highly optimized Android DEX bytecode generation using the Kotlin/R8 toolchain.<br>• *Note:* Precise benchmarks across the development team remain to be recorded. |
| **Implementation Challenges** | Pending documentation of issues faced throughout development. | Pending review of issues faced throughout implementation. |

## AI Usage

- **Claude (Anthropic):** Initial repository structure and drafting of documents in `docs/`[cite: 1].
- **Gemini (Google):** Technical phrasing improvements, verification of reliable reference sources, and seamless bilingual translation between the Spanish and English READMEs.