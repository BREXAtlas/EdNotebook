# Research-backed feature gaps

Date reviewed: July 19, 2026

The next build priorities should improve learning and reduce course setup work. They should not imitate competitors simply because those competitors are large.

## Scoring model

Each candidate is scored 1–5 on learning value, audience reach, fit with the existing product, delivery confidence, and differentiation. Risk/cost is subtracted. Maximum score is 24.

| Candidate | Learning | Reach | Fit | Confidence | Difference | Risk/cost | Total | Decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Syllabus-to-spaced study plan | 5 | 5 | 5 | 4 | 4 | 2 | 21 | Build next |
| Retrieval checks from course material | 5 | 5 | 5 | 4 | 4 | 2 | 21 | Build next |
| Open textbook/resource finder | 4 | 5 | 4 | 4 | 4 | 2 | 19 | Build after study plan |
| Course broadcast and guest checks | 4 | 4 | 5 | 4 | 5 | 2 | Foundation built |
| Office hours and study rooms | 4 | 4 | 4 | 3 | 4 | 4 | Controlled pilot |
| Better accessibility checks | 5 | 5 | 4 | 3 | 3 | 2 | Build continuously |
| Generic plagiarism detector | 2 | 3 | 2 | 1 | 1 | 5 | Do not build |
| Generic “AI writing” detector | 1 | 3 | 1 | 1 | 1 | 5 | Do not build |

## Why the top two win

Repeated retrieval improves delayed learning more than repeated studying in classic controlled research, and retrieval practice has also outperformed concept mapping on later comprehension and inference tests. Distributed practice has a substantial evidence base across hundreds of comparisons. Sources: [Karpicke & Roediger, Science (2008)](https://doi.org/10.1126/science.1152408), [Karpicke & Blunt, Science (2011)](https://pubmed.ncbi.nlm.nih.gov/21252317/), and [Cepeda et al., Psychological Bulletin (2006)](https://pubmed.ncbi.nlm.nih.gov/16719566/).

EdNotebook already extracts syllabus dates, classes, assignments, and course materials. That makes a transparent study plan and low-stakes retrieval checks a smaller, more coherent step than a new disconnected tool.

### Minimum useful version

1. Turn reviewed syllabus dates into study sessions before each deadline.
2. Let the student move, skip, or turn off every suggestion.
3. Generate short recall prompts only from material the user selects.
4. Show the source passage beside every generated answer.
5. Track confidence and next-review date, not a vague intelligence score.
6. Never change a published grade or professor deadline.

## Open resources

OpenStax reports more than 80 free, peer-reviewed, openly licensed textbooks for high school and college. A focused finder can connect professor-created lessons and student study plans to accessible source material without forcing a publisher workflow. Source: [OpenStax about](https://openstax.org/about).

Build this as a source catalog with license, edition, subject, chapter, and stable link metadata. Do not copy entire works into EdNotebook unless the specific license and attribution fields support it.

## Explicit non-goals

- Do not build a detector that labels writing as machine-generated.
- Do not make automated misconduct decisions.
- Do not market a score as proof about authorship.
- Do not reproduce Chegg, Turnitin, Blackboard, Schoology, or PowerSchool screens.

Turnitin's own current guidance says its detector can misidentify both human and generated writing and should not be the sole basis for adverse action. That limitation is enough reason for EdNotebook to focus on writing history, cited sources, drafts, and educator review instead. Source: [Turnitin AI Writing Report guidance](https://guides.turnitin.com/hc/en-us/articles/22774058814093-Using-the-AI-Writing-Report).

## Validation plan

- Run a four-week opt-in pilot for the spaced plan and retrieval checks.
- Compare completion, voluntary return use, and delayed recall checks with the same student's prior baseline.
- Ask students whether suggestions were understandable and controllable.
- Ask educators whether every prompt can be traced to an assigned source.
- Stop the pilot if the tool invents deadlines, obscures sources, or creates more correction work than it removes.
