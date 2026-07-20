# Claude Build Prompt — EdNotebook Business Presentation Website

Copy the prompt below into Claude Code or Claude with repository access.

---

You are Claude acting as a senior product storyteller, business analyst, data-visualization designer, frontend engineer, and investor-presentation developer for EdNotebook.

## Project

Repository:

```text
https://github.com/BREXAtlas/EdNotebook
```

Production site:

```text
https://ednotebook.com
```

Required governing source:

```text
docs/business/EDNOTEBOOK_BUSINESS_GOVERNANCE_AND_REINVESTMENT.md
```

Read that document completely before designing or writing the presentation.

Also inspect:

- Current public landing pages
- Current routing
- Work With Us, Careers, Publisher, Founding Access, and public portal experiences
- Existing colors, typography, cards, spacing, responsive behavior, and branding
- Current GitHub Pages/custom-domain build configuration
- Existing accessibility and security documentation

Do not replace or weaken current EdNotebook features. Build an additive public business-presentation experience and connect it to the existing Work With Us area.

## Primary objective

Create a responsive presentation website that explains:

1. What EdNotebook is
2. Why professor and teacher adoption is the first sale
3. Why student return proves daily usefulness
4. Why institutional trust is the end goal
5. Why outcome and engagement evidence are the fuel
6. How the platform earns its professional rebuild progressively through revenue
7. Why the $2 million–$8 million replacement-cost estimate does not require a one-time rebuild
8. When professional rebuilding becomes necessary
9. How revenue and gross profit are reinvested at each stage
10. How the Student, Professor, Institutional, Publishing, K–12, and Evidence divisions reinforce one another
11. Which intellectual-property assets can support other ventures
12. What partners, investors, professors, publishers, institutions, and future team members can do next

The presentation must follow this governing statement:

> EdNotebook is the learning evidence, communication, and publishing infrastructure connecting students, professors, institutions, and educational content.

And this commercial sequence:

```text
Professor and teacher adoption is the sale.
Student return is the proof of daily usefulness.
Institutional trust is the path to durable contracts.
Improved outcomes are the evidence that makes the platform valuable.
```

## Audience

The public presentation should work for:

- Professors and teachers
- University leaders
- Instructional designers
- Libraries
- Institutional research teams
- Publishers and authors
- Potential employees and contractors
- Strategic partners
- Pilot sponsors
- Grantmakers
- Investors

Do not write it only as an investor pitch. It should show a credible product, operating doctrine, partnership opportunity, and evidence strategy.

## Route and integration

Create a public route such as:

```text
/business
/work-with-us/business
/platform-vision
```

Choose the route that best fits the existing router after inspection.

Add an obvious but tasteful link from the current Work With Us page or public navigation:

```text
View the EdNotebook Platform & Growth Plan
```

Do not break existing routes.

Add appropriate:

- Canonical URL
- Open Graph metadata
- Social card metadata
- Structured data where appropriate
- Sitemap entry
- Responsive navigation
- Print-friendly version
- “Download briefing” or print-to-PDF action if the existing architecture permits it without a new unsafe dependency

The presentation must link back to:

```text
https://ednotebook.com
```

It should also include calls to action for:

- Pilot EdNotebook
- Work with us
- Publish with Alex B. Morrison Library
- Join Founding Access
- Explore Careers
- Contact Transform Ontology Systems

Use only routes or email addresses that actually exist in the repository. When an endpoint does not exist, create a safe interface or clearly label it as planned rather than inventing a live capability.

## Visual style

Use the current EdNotebook brand as the base.

The page should feel like a polished interactive business presentation, not a wall of text and not a generic SaaS template.

Design characteristics:

- Strong opening statement
- Clear section progression
- Large numerical callouts
- Accessible charts
- Evidence-first tone
- Editorial spacing
- Professional higher-education character
- Subtle animation with reduced-motion support
- Excellent mobile behavior
- Keyboard navigation
- High color contrast
- Clear data labels
- No misleading scarcity or unsupported claims

Avoid:

- Fake testimonials
- Fake customers
- Fake revenue
- Fake university endorsements
- Fake live user counts
- Unlabeled projections
- Unexplained valuations
- Stock-market-style hype
- Claims that EdNotebook has already produced outcome improvements without evidence

Every projection must be labeled:

```text
Internal planning scenario — not a guarantee
```

## Presentation structure

### Section 1 — Hero: The platform thesis

Headline direction:

```text
The course is where the relationship begins.
Evidence is where the platform becomes valuable.
```

Include:

- One-sentence EdNotebook definition
- Link to launch or explore EdNotebook
- Work With Us call to action
- Brief platform chain:

```text
Course design → student activity → evidence → outcomes → institutional trust
```

### Section 2 — The four proof obligations

Create four major interactive cards:

1. Professors and teachers adopt
2. Students return
3. Institutions trust
4. Outcomes improve

For each card show:

- Why it matters
- Absolutely necessary capabilities
- Proof metrics
- Current/Planned label derived honestly from the repository
- Dependencies on the other three obligations

Use the priority matrix in the governing document.

Highlight that professor and teacher adoption is the initial commercial sale and institutional adoption is the long-term goal.

### Section 3 — Necessary features, not feature volume

Build a visual priority map:

#### P0 — Required before scaling

- Authentication, roles, tenancy, and RLS
- Syllabus drop and course calendar
- Assignments, quizzes, and rubrics
- Learning outcomes and evidence mapping
- Secure materials
- Messaging and announcements
- Audit, privacy, retention, and legal holds
- Monitoring, backup, and recovery

#### P1 — Required for strong retention and institutional proof

- Due-Next and reminders
- Office-hours booking
- Evidence Studio
- Institutional administration and exports
- Accessibility and interoperability
- Shared spaces
- Discover Notebook

#### P2/P3 — Expansion

- Native widgets and expanded mobile capabilities
- Publishing marketplace
- Publisher intelligence
- Careers marketplace
- Broad K–12 expansion

Create a chart showing how each feature supports one or more proof obligations.

### Section 4 — Replacement cost versus staged rebuilding

Clearly explain:

- $2 million–$8 million is a professional replacement-cost planning range
- It is not a bill due today
- It is not the same as valuation
- EdNotebook should not stop for a one-time rewrite
- The platform should be professionally rebuilt module by module
- Critical security, privacy, accessibility, and data-isolation defects cannot wait for revenue

Create a visual comparison:

#### One-time speculative rebuild

```text
Large upfront cost
→ many unvalidated features
→ long delay
→ high waste risk
```

#### Revenue-funded staged rebuild

```text
Working product
→ professor adoption
→ student return
→ revenue
→ targeted professional hardening
→ institutional trust
→ larger contracts
```

Use a staircase, flywheel, or layered timeline visualization.

### Section 5 — When the rebuild becomes necessary

Create a milestone timeline with these trigger points:

#### Earliest professional-hardening trigger

The earliest of:

- 3–5 active professors using real courses
- 100–500 active students
- First paid institutional pilot
- First $100,000 ARR
- First contract with security, uptime, support, accessibility, or privacy obligations

#### Small dedicated-team trigger

The earliest of:

- $250,000–$500,000 ARR
- 1,000–5,000 monthly active learners
- 10–20 institutional/department customers
- Multiple live integrations
- Material publishing transactions
- Mobile application launch

#### Formal annual rebuild program

- Approximately $1 million ARR
- Or several institutions with recurring obligations

Emphasize:

> The valuation does not trigger the rebuild. Real operational obligations trigger the rebuild.

### Section 6 — Reinvestment doctrine

Create a reinvestment allocation visualization.

Target gross-profit allocation before durable product-market fit:

- Product, engineering, QA, security, accessibility, and infrastructure: 35%–50%
- Customer implementation, support, and success: 15%–25%
- Sales, pilots, partnerships, and responsible growth: 15%–25%
- Legal, compliance, insurance, finance, and administration: 5%–15%
- Cash reserve and contingency: 10%–20%

Create a clear distinction among:

- Revenue
- Gross profit
- Operating profit
- Available cash

Do not imply that a percentage of gross revenue is automatically spendable.

### Section 7 — Revenue-stage rebuild plan

Create a horizontal or vertical roadmap covering:

#### Stage 0: Pre-revenue to $100K annual revenue

Focus:

- Production stability
- Security
- Core professor workflow
- Student calendar
- Pilot support

Professional investment guide:

```text
$25K–$100K accumulated hardening
```

#### Stage 1: $100K–$500K ARR

Focus:

- Institutional tenancy
- Messaging/moderation
- Accessibility
- RLS testing
- Support operations
- SSO/LTI foundations

Annual rebuild budget:

```text
$150K–$400K
```

#### Stage 2: $500K–$2M ARR

Focus:

- Dedicated platform architecture
- Data and outcomes
- Mobile hardening
- Integrations
- Disaster recovery
- Publishing transactions

Annual rebuild budget:

```text
$400K–$1.2M
```

#### Stage 3: $2M–$10M ARR

Focus:

- Multi-institution scale
- Publishing
- Selected K–12
- Compliance programs
- Integration marketplace

Annual rebuild budget:

```text
$1M–$4M
```

#### Stage 4: Above $10M ARR

Focus:

- Formal continuous platform modernization
- Service ownership
- Multi-division operations

### Section 8 — Charts and financial visualizations

Create accessible, responsive charts using a maintainable chart library already in the repository or a lightweight, reviewed dependency.

Do not hard-code chart colors that fail contrast.

Required charts:

#### Chart A — Five-year base revenue scenario

Use this data:

| Revenue stream | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
|---|---:|---:|---:|---:|---:|
| Students | 25000 | 250000 | 1200000 | 3500000 | 7500000 |
| Professors | 40000 | 250000 | 900000 | 2300000 | 5000000 |
| Higher education | 75000 | 500000 | 2200000 | 6000000 | 12000000 |
| K–12 | 0 | 100000 | 750000 | 3000000 | 8000000 |
| Publishing subscriptions | 15000 | 150000 | 600000 | 1800000 | 4000000 |
| Marketplace commission | 5000 | 100000 | 700000 | 2500000 | 6000000 |
| Analytics and research | 20000 | 150000 | 750000 | 2000000 | 4000000 |
| Implementation and training | 50000 | 300000 | 900000 | 1700000 | 2500000 |
| Careers and employer services | 0 | 50000 | 250000 | 750000 | 1500000 |

Totals:

```text
Year 1: $230K
Year 2: $1.85M
Year 3: $8.25M
Year 4: $23.55M
Year 5: $50.5M
```

Use a stacked bar chart and a separate total-revenue line chart.

Label:

```text
Internal base-case planning scenario — not a guarantee
```

#### Chart B — Gross-profit reinvestment capacity

Use:

| Stage | Revenue | Gross margin | Rebuild share | Low rebuild capacity | High rebuild capacity |
|---|---:|---:|---:|---:|---:|
| Validation | 100000 | 0.50 | 0.40–0.50 | 20000 | 25000 |
| Early contracts | 500000 | 0.60 | 0.35–0.45 | 105000 | 135000 |
| Institutional proof | 1000000 | 0.65 | 0.30–0.40 | 195000 | 260000 |
| Repeatable growth | 2000000 | 0.70 | 0.25–0.35 | 350000 | 490000 |
| Platform scale | 5000000 | 0.72 | 0.20–0.30 | 720000 | 1080000 |
| Multi-division scale | 10000000 | 0.75 | 0.20–0.25 | 1500000 | 1875000 |

Create a range/bar chart that shows the growing ability to fund professional rebuilding from operations.

#### Chart C — Proof obligation flywheel

Visualize:

```text
Professor adoption
→ students join and return
→ outcome evidence grows
→ institutions trust and contract
→ revenue funds professional hardening
→ stronger professor adoption
```

#### Chart D — Division contribution map

Show:

- Professor division: acquisition engine
- Student division: engagement and network engine
- Institutional division: durable recurring revenue engine
- Publishing division: transaction and distribution engine
- K–12: later expansion engine
- Evidence/research: proof and intelligence engine

#### Chart E — Feature priority matrix

Use the P0/P1/P2/P3 matrix from the governing document.

#### Chart F — Valuation evidence ladder

Use planning ranges:

- Product and architecture, limited sustained use: $500K–$2M
- Stable beta and credible active cohort: $1M–$5M
- Signed institutional pilot and outcome plan: $3M–$8M
- $250K–$500K ARR with retention: $5M–$12M
- About $1M ARR with strong growth: $10M–$25M
- $5M ARR with durable institutional retention: $30M–$75M

Label these as internal planning scenarios, not appraisals.

### Section 9 — Business divisions

Create a section for each division:

#### Professor and Teacher

- Primary acquisition engine
- Professor Pro
- Department plans
- Implementation
- Professional development
- Author/publishing services

#### Student

- Engagement and network engine
- Free Core
- Optional premium
- Referral perks
- Books and supplements
- Careers and portfolio

#### Institutional

- Durable recurring-revenue engine
- Department and institution licenses
- Implementation
- Integrations
- Premium support
- Evidence and governance

#### Publishing: Alex B. Morrison Library

- Transaction and distribution engine
- Markdown-to-EduBook
- Author/publisher subscriptions
- Conversion services
- Sales and rentals
- Chapter supplements
- Aggregate adoption intelligence

#### K–12

- Later expansion engine
- Per-student licensing
- School/district contracts
- Implementation
- Curriculum marketplace

#### Evidence and Research

- Proof and intelligence engine
- Evidence Studio
- Program evaluation
- Outcome reporting
- Approved research partnerships

Do not describe identifiable student data as a product.

### Section 10 — IP and reusable assets

Create an interactive asset map for:

- Course Forge
- EduBook/1.0
- EdSlides/1.0
- Learning Evidence Graph
- Learning-outcome architecture
- Discover
- Discover Notebook
- Evidence Studio
- Communication/moderation control plane
- Secure educational file pipeline
- Markdown publishing compiler
- Section-density network engine
- Institutional entitlement engine
- Privacy, research, retention, and audit architecture
- Native engagement architecture

Show possible reuse in:

- Corporate training
- Professional certification
- Healthcare competency
- Military/government training
- Ministry and nonprofit education
- Secure publishing
- Research intelligence
- Program evaluation
- Workforce development
- Membership/community platforms

Include a clear notice that customer data, licensed materials, institutional records, and private trade secrets cannot be reused merely because the platform software is reusable.

### Section 11 — What a $1M pre-seed planning valuation means

Explain clearly:

- A $1M valuation is a financing negotiation or planning point, not cash in the bank
- It does not pay for a rebuild unless money is actually invested
- Valuation alone does not create engineering capacity
- The company should begin professional hardening before institutional dependency
- Revenue, grants, services, pilots, and financing can fund staged improvements
- Replacement cost supports the asset narrative but does not prove market value

Use this key statement:

> The valuation does not trigger the rebuild. Real users, contracts, data obligations, and operational risk trigger the rebuild.

### Section 12 — Partnership and Work With Us

Create pathways for:

- Professor beta partners
- Institutional pilot partners
- Libraries
- Publishers and authors
- Research collaborators
- Instructional designers
- Accessibility and security partners
- Future employees and contractors
- Grant and investment conversations

Use honest status labels:

- Available now
- Beta
- In development
- Planned
- Requires partner activation

### Section 13 — Final recommendation

End with the strongest governing conclusion:

> EdNotebook will not wait for a multimillion-dollar one-time rebuild. It will earn the rebuild through professor-led adoption, student return, institutional trust, and demonstrated learning outcomes. Revenue and financing will be reinvested continuously into professional quality, beginning before the first material institutional deployment and increasing with the platform’s obligations.

Include buttons:

- Explore EdNotebook
- Pilot EdNotebook
- Work With Us
- Publish With Us
- View Careers

## Data and content requirements

Store chart data in a reusable structured module, such as:

```text
src/data/businessPresentationData.js
```

or an equivalent location matching the current architecture.

Do not bury all financial values directly inside JSX.

Each dataset must contain:

- Label
- Value
- Unit
- Scenario label
- Source document path
- Last reviewed date
- Disclaimer

Create a single update path so future revenue, valuation, and reinvestment assumptions can be changed without rewriting the page.

## Accessibility requirements

- WCAG-oriented semantic structure
- Keyboard-accessible controls
- Visible focus
- Reduced-motion support
- Text alternatives for charts
- Data tables available below or beside charts
- No information conveyed only through color
- Proper heading order
- Screen-reader-friendly currency formatting
- Mobile chart fallbacks
- Print/PDF readability

## Performance requirements

- Lazy-load heavy visual modules
- Avoid unnecessary video backgrounds
- Optimize initial route payload
- Do not load private application data
- Do not expose Supabase secrets
- Do not require authentication to view the presentation
- Preserve the custom-domain root build
- Test direct navigation and refresh

## Security and privacy

- Public planning data only
- No private system map
- No customer names unless already authorized and public
- No student data
- No live private Supabase queries
- No investor contact information unless already public
- No secrets in the bundle
- No unsanitized Markdown rendering
- No arbitrary external embeds

## Required implementation outputs

Create:

- Public presentation route and components
- Responsive styles
- Reusable financial data module
- Accessible chart components
- Work With Us navigation link
- Metadata and sitemap updates
- Print/PDF presentation mode
- Tests
- Screenshots
- Documentation:

```text
docs/business/BUSINESS_PRESENTATION_IMPLEMENTATION.md
```

That documentation must explain:

- Route
- Source data
- How to update projections
- How to update valuation ranges
- How to add a division
- How to update reinvestment targets
- Accessibility decisions
- SEO behavior
- Print/PDF behavior
- Known limitations

## Test requirements

Run:

- Locked dependency install
- Production build
- Route/direct-refresh tests
- Mobile responsive tests
- Accessibility checks
- Initial-HTML/metadata test
- Chart data validation
- Currency total validation
- Reduced-motion test
- Print layout test
- Broken-link test
- Bundle/secret scan

Add automated assertions that base-case revenue totals equal:

```text
230000
1850000
8250000
23550000
50500000
```

Do not silently alter these numbers. When changing an assumption, update the governing document and presentation dataset together.

## Git workflow

1. Inspect current main.
2. Create a new branch:

```text
agent/business-presentation-work-with-us
```

3. Build the complete presentation.
4. Run all relevant tests.
5. Fix failures.
6. Create a detailed pull request.
7. Do not push directly to main.
8. State which content is planning-only and which features are live.

Begin by summarizing the existing Work With Us/public architecture, identifying the exact route and files you will modify, and then build the complete presentation from beginning to end.
