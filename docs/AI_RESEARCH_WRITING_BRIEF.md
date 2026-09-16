# AI Research and Publication Brief

## Purpose

Use this document as context for an AI research assistant. The assistant should
help identify comparable studies, organize a literature review, design an
evaluation, and draft a publishable research paper about this system. It must
not invent citations, results, participants, or implementation details.

The working research title is:

> **Design and Development of an Intelligent Service Request Monitoring and
> Analysis Platform for ICT Departments in Higher-Education Institutions**

The system was developed for the ICT Department of Carlos Hilado Memorial
State University (CHMSU), Talisay Campus, in the Philippine higher-education
context. The final paper may use a more general title if the study is intended
for adoption by other state universities and colleges (SUCs). Confirm the
institution's preferred official name before publication.

---

## System at a Glance

This is a web-based ICT service-request and support-ticket platform. It
centralizes requests that would otherwise be received through fragmented,
manual, or semi-digital channels. The platform records each request, applies a
controlled workflow, assigns responsibility, tracks service-level deadlines,
notifies stakeholders, and provides operational analytics.

The system has two request domains:

- **MIS requests:** website and software development, updates, and installation.
- **ITS requests:** equipment borrowing and maintenance involving computers,
  networks, internet connectivity, and printers.

The core workflow is:

```text
User submits request
  → Secretary review
  → Director approval
  → Department-head assignment
  → Staff work and status updates
  → Resolution
  → Closure and optional satisfaction survey
```

Implemented status values include `FOR_REVIEW`, `REVIEWED`,
`DIRECTOR_APPROVED`, `ASSIGNED`, `PENDING`, `IN_PROGRESS`, `ON_HOLD`,
`RESOLVED`, `CLOSED`, and `CANCELLED`.

## Implemented Technical Features

### Request and workflow management

- Angular web frontend with standalone components and NG-ZORRO UI.
- Node.js/TypeScript backend using Express, Apollo GraphQL, Prisma, and
  MySQL.
- Role-based access for administrators, directors, secretaries, department
  heads, technical staff, developers, and end users.
- JWT and Auth0 authentication options.
- Separate MIS and ITS forms with control numbers and attachments.
- Secretary review, director approval, assignment, scheduling, monitoring,
  resolution, closure, cancellation, and reopening workflows.
- Status history, internal/public notes, notifications, and file handling.

### Intelligence and self-service

- Google Gemini-assisted ticket analysis during submission.
- Analysis can produce a cleaned description, summary, category, priority,
  root-cause hypothesis, and possible solutions.
- Similar resolved tickets are retrieved using ticket text search.
- Related knowledge-base articles and troubleshooting solutions are surfaced
  as retrieval-augmented context.
- A chat interface can answer self-service questions, use the knowledge base
  and resolved tickets, guide ticket creation, and support selected
  operational queries.
- A client-side keyword-based priority suggestion provides a confidence
  indicator; the user can override it.
- AI suggestions are advisory, not autonomous final decisions.

### Monitoring, SLA, and analytics

- Priority levels are LOW, MEDIUM, HIGH, and CRITICAL.
- Due dates and estimated/actual durations support service-level tracking.
- A scheduled job checks overdue tickets and sends escalation notifications.
- Escalation level and escalation time are recorded.
- WebSocket/GraphQL subscriptions provide real-time updates, with polling as
  a fallback.
- Analytics cover ticket totals, status/type/priority distributions, trends,
  SLA compliance, overdue tickets, average resolution time, staff performance,
  and workload.
- Reports can be exported to PDF and Excel.
- Request creators can submit a 1–5 satisfaction rating and comment after
  resolution.

## Important Scope and Evidence Boundaries

Treat the following as facts to verify against source code, database records,
deployment configuration, and test results before publication:

1. This repository describes the design and implementation; it does **not**
   automatically prove effectiveness.
2. Do not claim improved turnaround time, satisfaction, productivity, or SLA
   compliance unless a study measures those outcomes against a documented
   baseline or comparison.
3. Do not call the system machine-learning-based unless the paper clearly
   distinguishes Gemini/LLM assistance, keyword rules, full-text retrieval,
   and any separately trained model.
4. Do not describe a feature as evaluated merely because it is implemented.
5. Verify the actual deployment date, number and type of users, ticket volume,
   model name/version, prompts, API settings, security controls, and database
   configuration.
6. Remove personal names, email addresses, credentials, API keys, real ticket
   text, and identifiable user information from the manuscript and shared
   datasets.
7. Replace provisional proposal references with traceable scholarly sources.
   Never fabricate a DOI, author, journal, quotation, or result.

## Suggested Research Framing

The strongest research framing is a **design-and-development / applied
information-systems study** with a transparent evaluation. Depending on the
actual study design, the work may also be framed as:

- design science research;
- a case study of ICT service management in a higher-education institution;
- action research involving iterative improvement with stakeholders; or
- a mixed-method evaluation combining system metrics and user feedback.

Potential research problem:

> ICT service requests in higher-education institutions may be difficult to
> track consistently because submission, approval, assignment, communication,
> deadline monitoring, and reporting are distributed across manual or
> disconnected processes. This can reduce visibility, accountability, and the
> ability of ICT managers to make evidence-based decisions.

Potential contribution:

> A role-aware, approval-controlled, AI-assisted, real-time service-request
> platform that combines ticket lifecycle management, retrieval-supported
> self-service, SLA monitoring, escalation, and operational analytics for a
> resource-constrained higher-education ICT environment.

These are proposed framings, not findings. Select the one supported by the
research protocol and collected evidence.

## Research Questions to Refine

Ask the researcher to select and operationalize only questions that can
actually be answered:

1. What information, workflow, and accountability problems exist in the
   current ICT service-request process?
2. How can a role-based platform model the request lifecycle from submission
   through closure?
3. How accurately and usefully do the AI-assisted categorization, priority,
   similarity, and knowledge-base recommendations support ticket intake?
4. How does the platform affect measurable service indicators such as
   first-response time, resolution time, SLA compliance, reassignment rate,
   backlog, and escalation rate?
5. How do end users and ICT personnel perceive usability, usefulness,
   transparency, trust, and intention to continue using the platform?
6. What privacy, security, bias, hallucination, and human-oversight risks arise
   from using a hosted generative-AI service for ICT support?

Possible hypotheses or propositions should be generated only after the
variables, baseline, sample, and analysis plan are known.

## Evaluation Data to Prepare

Ask the AI to help create a data dictionary and protocol for:

- ticket count by period, type, category, priority, and status;
- time to first response, approval, assignment, resolution, and closure;
- SLA due dates, breaches, escalations, and compliance;
- reassignment, reopening, cancellation, and backlog rates;
- AI recommendation accuracy, user override rate, and confidence;
- retrieval relevance for similar tickets and knowledge-base articles;
- chatbot deflection or successful self-service rate, if measured;
- user satisfaction and validated usability scores;
- staff workload and perceived administrative effort;
- system availability, response time, and error rates.

Use pre/post, interrupted time-series, controlled comparison, usability
testing, expert review, or another defensible design. Report sample sizes,
missing data, inclusion criteria, consent, privacy protection, and limitations.
Do not invent a baseline if none exists; label the work as a prototype or
descriptive case study when appropriate.

## Literature Search Strategy

Find peer-reviewed and authoritative sources in these overlapping areas:

- higher-education ICT service management and service desks;
- IT service management, incident/request management, and SLA monitoring;
- university help-desk or e-government workflow systems;
- design science and information-systems system development;
- intelligent ticket classification, routing, priority prediction, and
  duplicate/similar-ticket detection;
- retrieval-augmented generation, knowledge bases, and conversational
  self-service for technical support;
- human-AI decision support, explainability, trust, and human oversight;
- usability, technology acceptance, service quality, and digital
  transformation in higher education;
- privacy, security, fairness, and governance of generative AI in education.

For every candidate source, return:

1. complete citation in the requested style;
2. DOI or stable publisher URL;
3. study setting, participants, method, and sample;
4. system or intervention features;
5. measured outcomes and limitations;
6. exact relevance to this platform;
7. whether it is a direct comparable system, a methodological source, or
   background/context;
8. a short quotation only when the source has been checked directly.

Search synonyms rather than relying on the phrase “service request.” Try
“IT service desk,” “help desk ticketing,” “incident management,” “academic
ICT support,” “university service portal,” “intelligent ticket routing,”
“support ticket classification,” “SLA compliance,” and “AI-assisted
technical support.”

## Publication Deliverables

Help prepare the following in sequence:

1. evidence table and annotated bibliography;
2. research gap and novelty statement;
3. conceptual or system framework;
4. research questions, variables, and operational definitions;
5. methodology, ethics, data-management, and evaluation plan;
6. system architecture and workflow figures;
7. results tables and statistical/qualitative analysis plan;
8. discussion that separates measured findings from design rationale;
9. limitations, threats to validity, AI risks, and future work;
10. manuscript formatted for the target journal or conference;
11. anonymized supplementary materials, survey instruments, code/data
    availability statement, and reproducibility checklist.

Use the target venue's author guidelines rather than assuming IMRaD is
required, but a conventional manuscript will usually contain:

```text
Title · Abstract · Keywords · Introduction · Related Work
· Methodology · System Design and Development · Evaluation/Results
· Discussion · Limitations and Ethical Considerations
· Conclusion · Data/Code Availability · References
```

## Copy-and-Paste Prompt for a Research AI

```text
You are my research assistant and publication-writing partner. Read the
attached “AI Research and Publication Brief” before doing anything else.

My goal is to publish a rigorous paper about the described ICT service-request
platform. First, summarize the system in your own words and list which claims
are implemented, which are proposed, and which require empirical verification.
Then help me:

1. identify the closest peer-reviewed studies and authoritative standards;
2. build a comparison matrix showing setting, method, system features, AI
   technique, evaluation metrics, results, limitations, and relevance;
3. identify a defensible research gap and avoid overstating novelty;
4. recommend an appropriate research design and explain why;
5. define research questions, variables, metrics, sampling, instruments, and
   analysis methods;
6. design an evaluation that can test effectiveness, usability, service
   quality, SLA outcomes, AI recommendation quality, and human oversight;
7. propose a paper outline aligned with the target venue's author guidelines;
8. draft sections only from verified project evidence and sources I provide;
9. identify missing evidence, ethical approvals, privacy safeguards, and
   reproducibility materials;
10. suggest neutral titles, keywords, figures, tables, and future-work items.

For literature searches, prioritize recent peer-reviewed work but include
seminal methods and official standards where necessary. Verify every citation
from a reliable source and provide a DOI or stable URL. Never fabricate or
guess a citation, result, statistic, participant count, quote, DOI, or system
capability. Clearly label assumptions and ask me questions when information is
missing. Distinguish an LLM API, retrieval, keyword rules, and trained
machine-learning models. Do not claim that implementation equals effectiveness.
Do not expose personal data, credentials, API keys, or identifiable ticket
content. Use [EVIDENCE NEEDED] markers wherever I must supply data.

Begin with:
A. a one-paragraph system summary;
B. a verified-vs-unverified claims table;
C. ten focused literature-search queries;
D. five questions I must answer before drafting the methodology.
```

## Researcher Checklist Before Submission

- [ ] Confirm the final system scope and deployment context.
- [ ] Obtain institutional ethics or research approval where required.
- [ ] Define the population, sample, consent process, and anonymization plan.
- [ ] Freeze the software version, model configuration, prompts, and evaluation
      period.
- [ ] Preserve an audit trail for data cleaning and statistical analysis.
- [ ] Validate all citations and check the target venue's requirements.
- [ ] Report negative, null, and conflicting results.
- [ ] State what the system cannot do and where human review is mandatory.
- [ ] Review the final manuscript for unsupported AI-generated text and
      plagiarism before submission.
