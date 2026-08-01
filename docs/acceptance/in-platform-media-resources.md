# In-platform media and resources acceptance

This gate proves the professor-to-student media path without changing the production project.

## Professor

1. Sign in to staging as the professor and open **Course builder → Course Output Studio**.
2. Select **Media & resources**, then **Link or YouTube**.
3. Paste a public YouTube URL, add a learner-facing title and description, choose **Inside a lesson**, and select the exact Digital Literacy lesson.
4. Save it. Confirm the library calls it **Draft until next publish**.
5. Return to the course output footer and publish the updated course version.

## Student

1. Sign in to staging as an enrolled student and open the same published course.
2. Open the targeted lesson and advance to **Read**.
3. Confirm the professor video appears under **Professor-published media**.
4. Select **Play here in EdNotebook**. Playback must remain inside the lesson in the privacy-enhanced EdNotebook reader; it must not navigate to YouTube.
5. Open **Media & resources**. Save an HTTPS link or YouTube video under **My course resources** and confirm it plays or displays there.
6. Sign back in as professor and confirm the learner's private resource is not visible.

## Evidence expected

- The published resource records an exact course publication version.
- Editing a professor resource returns it to draft and does not change the currently live student snapshot until republished.
- A learner cannot publish a resource to classmates.
- A non-member cannot retrieve the published resource envelope.
- Browser roles cannot query the immutable snapshot table directly.
