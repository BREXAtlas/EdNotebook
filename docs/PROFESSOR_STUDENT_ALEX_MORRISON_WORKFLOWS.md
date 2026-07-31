# Professor, student, and Alex B. Morrison workflows

These maps describe the governed EdNotebook experience after the Phase 5
course, enrollment, calendar, notification, writing, and publishing units.
Solid paths are usable product paths. The dashed commerce path remains a
controlled preview until seller, tax, refund, dispute, checkout, and payout
controls are approved.

## 1. Professor teaching workflow

```mermaid
flowchart LR
  P["Professor account"] --> D["Organized teaching dashboard"]
  D --> B["Course Builder"]
  B --> S["Syllabus extraction and calendar"]
  S --> G["Governed lesson generation"]
  G --> R["Professor review and acceptance"]
  R --> O["Student-experience preview"]
  O --> PUB["Publish approved course package"]
  PUB --> CL["Professor class library"]
  CL --> EA{"Student access"}
  EA --> AP["Professor approval required"]
  EA --> OE["Open self-enrollment"]
  OE --> UA{"Assign to every eligible new student?"}
  UA -->|Yes| AUTO["Universal assignment"]
  UA -->|No| DIR["Searchable class directory"]
  AP --> Q["Enrollment request queue"]
  Q --> ACCEPT["Professor accepts student"]
  AUTO --> N["Student notification"]
  ACCEPT --> N
  DIR --> N
  N --> LIVE["Protected student course workspace"]
  LIVE --> FB["Assignments, messages, feedback, grades"]
  FB --> P
```

## 2. Student experience workflow

```mermaid
flowchart LR
  START["Student chooses university"] --> FIND{"Where the course is found"}
  FIND --> SEARCH["Public class search"]
  FIND --> LIB["Alex B. Morrison Library"]
  FIND --> AUTO["Professor universal assignment"]
  SEARCH --> PREVIEW["Course preview"]
  LIB --> PREVIEW
  PREVIEW --> ACCESS{"Enrollment policy"}
  ACCESS --> OPEN["Join immediately"]
  ACCESS --> REQUEST["Request professor approval"]
  REQUEST --> WAIT["Pending queue"]
  WAIT --> APPROVED["Professor approves"]
  OPEN --> NOTE["Enrollment notification"]
  APPROVED --> NOTE
  AUTO --> NOTE
  NOTE --> CLASSES["My class library"]
  CLASSES --> COURSE["Read · Teach · Act course view"]
  COURSE --> CAL["Traditional calendar and reminders"]
  COURSE --> WORK["Assignments and writing workspace"]
  COURSE --> MSG["Course messaging and feedback"]
  COURSE --> PROGRESS["Progress and knowledge checks"]
  PROGRESS --> COMPLETE["Completion"]
  COMPLETE --> BADGE["Course badge in Social Learning"]
  COMPLETE --> GRADE["Published grade, when applicable"]
  CAL --> BELL["Unified notification bell"]
  MSG --> BELL
  GRADE --> BELL
  BELL --> COURSE
```

## 3. Combined professor-to-student lifecycle

```mermaid
sequenceDiagram
  participant Professor
  participant CourseBuilder as "Course Builder"
  participant Directory as "Class + Library directories"
  participant Student
  participant Notifications

  Professor->>CourseBuilder: Build and review course
  Professor->>CourseBuilder: Publish approved package
  CourseBuilder->>Directory: Reference the same published package
  Professor->>Directory: Choose class enrollment policy
  Professor->>Directory: Choose Library visibility
  Professor->>Directory: Choose universal assignment separately
  Student->>Directory: Search and preview
  alt Open self-enrollment
    Student->>Directory: Join course
    Directory->>Notifications: Enrollment confirmed
  else Professor approval
    Student->>Professor: Request enrollment
    Professor->>Directory: Approve course link
    Directory->>Notifications: Enrollment approved
  else Universal assignment
    Directory->>Notifications: New course assigned
  end
  Notifications->>Student: Open the triggering course
  Student->>Professor: Submit work or message
  Professor->>Student: Feedback or published grade
  Professor->>Notifications: Release feedback/grade event
  Notifications->>Student: Open the triggering assignment
```

## 4. Professor to Alex B. Morrison Library/Bookstore

```mermaid
flowchart TB
  PROFESSOR["Professor / professor-author"] --> CHOICE{"Publish a course or a book?"}

  CHOICE --> COURSE["Approved course package"]
  COURSE --> COURSELIST{"Library placement"}
  COURSELIST --> CPRIVATE["Not in Library"]
  COURSELIST --> CFREE["Free Library course"]
  COURSELIST -.-> CPAID["Purchase or rental preview"]
  CFREE --> CATALOG["Searchable Alex B. Morrison catalog"]
  CATALOG --> CPREVIEW["Student visits course preview"]
  CPREVIEW --> CENROLL{"Join now or request approval"}
  CENROLL --> CWORK["Student course workspace"]

  CHOICE --> BOOK["Original or licensed book source"]
  BOOK --> SECURE["Secure source upload / conversion"]
  SECURE --> MODE{"Book experience"}
  MODE --> READ["Read-only book"]
  MODE --> INTERACTIVE["Interactive EduBook"]
  INTERACTIVE --> LAYERS["Progress · notes · checks · quizzes · discussion"]
  READ --> BOOKPLACE{"Book placement"}
  LAYERS --> BOOKPLACE
  BOOKPLACE --> BPRIVATE["Private draft"]
  BOOKPLACE --> ASSIGNED["Assign same book record to a course"]
  BOOKPLACE --> BOPEN["Free open Library book"]
  BOOKPLACE -.-> BPAID["Purchase or rental preview"]
  ASSIGNED --> COURSEWORK["Assigned reading inside the student class"]
  BOPEN --> CATALOG

  CPAID -.-> REVIEW["Rights + seller + accessibility + pricing review"]
  BPAID -.-> REVIEW
  REVIEW -.-> CHECKOUT["Governed checkout"]
  CHECKOUT -.-> ENTITLEMENT["Student purchase/rental entitlement"]
  ENTITLEMENT -.-> PAYOUT["Refund/dispute-aware seller payout"]
```

### Product rules shown in the maps

- Course publishing, Library listing, enrollment approval, and universal
  assignment are separate controls.
- A course listing references its already-approved course package.
- A linked or assigned book keeps one publication source record.
- Free courses and open books can be searchable and visitable now.
- Assigned books require access to the linked course.
- A read-only book keeps the familiar book experience; an interactive EduBook
  can add progress, private annotations, knowledge checks, quizzes, and
  discussion layers.
- Commercial prices may be prepared for review, but the client cannot grant
  paid access. Checkout and seller payout remain behind the commerce gate.
