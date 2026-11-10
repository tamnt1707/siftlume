/**
 * Before / after shots for Vietnamese communities: an English tech article next to the summary
 * Siftlume writes in Vietnamese (Settings → Summary language). The publications are made up and
 * every figure in a summary comes from its article. Render with `?view=post&post=<id>&lang=vi`.
 */
export interface Post {
  site: string;
  url: string;
  section: string;
  title: string;
  dek: string;
  byline: string;
  minutes: number;
  paragraphs: string[];
  /** Code block shown after the paragraph at codeAfter. */
  code?: string;
  codeAfter?: number;
  /** What the side panel shows: the kind of reading, in Vietnamese. */
  mode: string;
  summary: string;
}

const DOCKERFILE = `FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
CMD node dist/server.js`;

/** The Dockerfile as an OpenUI Lang string literal (newlines escaped). */
const dockerfileLiteral = DOCKERFILE.replace(/\n/g, '\\n');

export const POSTS: Record<string, Post> = {
  passkeys: {
    site: 'Byte Ledger',
    url: 'byteledger.example/security/passkeys-explained',
    section: 'Security',
    title: 'Passkeys, explained: why your next login won’t need a password',
    dek: 'They are built on public-key cryptography, they can’t be phished, and they already work on most of the sites you use. Here is what actually happens when you sign in with one.',
    byline: 'By Priya Raman · 11 min read',
    minutes: 11,
    mode: 'Giải thích',
    paragraphs: [
      'For thirty years, the password has been the front door of the internet, and for thirty years it has been the weakest part of the house. People reuse them, forget them, write them on sticky notes and type them into convincing fake login pages. Passkeys are the industry’s most serious attempt yet to retire them.',
      'A passkey is a pair of cryptographic keys created by your device for one specific website. The public key is sent to the site and stored on its servers. The private key never leaves your device; it sits in a secure chip or in your password manager, unlocked by your fingerprint, your face or your device PIN.',
      'When you sign in, the site sends your device a random challenge. Your device signs that challenge with the private key, and the site checks the signature with the public key it already has. Nothing secret crosses the network, so there is nothing for an attacker to intercept or for a breached server to leak.',
      'That design is what makes passkeys resistant to phishing. A passkey is bound to the exact domain it was created for. If a fake page at a look-alike address asks you to sign in, your device simply has no passkey for that domain and will not offer one. You can’t be tricked into handing over something you never see.',
      'A common worry is that your face or fingerprint is being sent to the website. It is not. The biometric check happens locally and only unlocks the private key on your device. The website learns that the signature is valid, not what your face looks like.',
      'Another worry is losing your phone. Most passkeys today are synced: Apple stores them in iCloud Keychain, Google in Google Password Manager, and password managers such as 1Password and Bitwarden sync their own. A new device signed in to the same account gets your passkeys back. You can also sign in on a computer by scanning a QR code with your phone.',
      'Passkeys are not perfect yet. Moving them between ecosystems, from Apple to Google for example, is still clumsy. Some sites still ask for a password as a fallback, which keeps the old weakness alive. And account recovery, when you lose every device, still depends on each site’s own process.',
      'For most people, the advice is simple: when a site offers to create a passkey, accept it. Keep your Apple or Google account, or your password manager, protected with a strong password and two-factor authentication, because it now guards the keys to everything else.',
      'The standards behind passkeys are FIDO2 and WebAuthn, developed by the FIDO Alliance and the W3C, and every major browser and operating system supports them.',
    ],
    summary: `root = Card([hero, takeaways, analogy, myths, quote, how, todo, glossary, followUps], [{title: "Passkeys, explained", sourceName: "Byte Ledger", url: "https://byteledger.example/security/passkeys-explained"}])
hero = SummaryHero("Passkey sẽ thay mật khẩu như thế nào", "Passkey dùng một cặp khóa mã hóa: khóa bí mật không bao giờ rời thiết bị, nên không bị lộ khi server bị hack và không thể bị lừa lấy mất.", null, 11)
analogy = Analogy("ổ khóa và chìa khóa", "Website chỉ giữ ổ khóa (khóa công khai). Chìa khóa (khóa bí mật) nằm trong máy bạn, mở bằng vân tay, khuôn mặt hoặc mã PIN.")
how = Diagram("flowchart TD\\n  A[Website gửi mã thử ngẫu nhiên] --> B[Bạn mở khóa bằng vân tay hoặc khuôn mặt]\\n  B --> C[Thiết bị ký mã thử bằng khóa bí mật]\\n  C --> D[Website kiểm tra bằng khóa công khai]\\n  D --> E[Đăng nhập xong]", "Không có bí mật nào đi qua mạng")
takeaways = Takeaways([t1, t2, t3], "Vì sao an toàn hơn")
t1 = Takeaway("Chống phishing", "Passkey gắn với đúng tên miền, trang giả không có passkey để xin")
t2 = Takeaway("Server bị hack cũng không lộ gì", "Website chỉ lưu khóa công khai")
t3 = Takeaway("Mất điện thoại vẫn lấy lại được", "Đồng bộ qua iCloud Keychain, Google Password Manager, 1Password, Bitwarden")
myths = Misconceptions([m1, m2])
m1 = Misconception("Website nhận được vân tay hoặc khuôn mặt của bạn", "Việc kiểm tra diễn ra ngay trên máy, chỉ để mở khóa bí mật")
m2 = Misconception("Passkey đã hoàn hảo", "Chuyển giữa Apple và Google còn bất tiện, nhiều trang vẫn giữ mật khẩu dự phòng")
quote = SourceQuote("You can’t be tricked into handing over something you never see.", "Lý do passkey chống được phishing")
todo = Checklist(["Đồng ý khi trang web đề nghị tạo passkey", "Bảo vệ tài khoản Apple, Google hoặc trình quản lý mật khẩu bằng mật khẩu mạnh và 2FA"], "Nên làm ngay")
glossary = Glossary([g1, g2])
g1 = Term("WebAuthn", "Chuẩn web cho phép đăng nhập bằng khóa mã hóa")
g2 = Term("FIDO2", "Bộ chuẩn của FIDO Alliance mà passkey dựa trên")
followUps = FollowUpBlock([FollowUpItem("Mất hết thiết bị thì khôi phục thế nào?"), FollowUpItem("Có nên bỏ hẳn mật khẩu không?")])`,
  },

  database: {
    site: 'Stack & Scale',
    url: 'stackandscale.example/databases/sqlite-or-postgres',
    section: 'Databases',
    title: 'SQLite or Postgres? How to pick a database for your next side project',
    dek: 'SQLite is no longer just for prototypes, and Postgres is no longer hard to run. We compared both on the things that matter for a small app.',
    byline: 'By Daniel Okoye · 13 min read',
    minutes: 13,
    mode: 'Tóm tắt',
    paragraphs: [
      'Every side project starts with the same question, usually asked late at night: which database? For a long time the answer was “Postgres for anything real, SQLite for toys”. That rule no longer holds as neatly as it used to.',
      'SQLite is a library, not a server. Your database is a single file that lives next to your app, and queries run inside your process with no network hop. For a small app with a few thousand users, that means very fast reads and nothing extra to deploy, patch or monitor.',
      'Its limits are well known. SQLite allows only one writer at a time. With write-ahead logging (WAL) turned on, readers no longer block the writer, and a single writer can handle far more traffic than most side projects will ever see. But if many servers need to write to the same database, SQLite is the wrong tool.',
      'Postgres is a full database server. It handles many concurrent writers, has a rich type system with JSONB, arrays and full-text search, and an ecosystem of extensions such as PostGIS for maps and pgvector for embeddings. If you expect several app servers, background workers and analytics queries hitting the same data, it is the safer default.',
      'Running Postgres used to be the main cost. Today managed services offer free or cheap tiers, so you rarely run it yourself. The trade-off is another service to depend on, network latency on every query, and connection limits to manage.',
      'Backups differ too. A SQLite backup can be as simple as copying the file safely, and tools such as Litestream stream changes to object storage continuously. Postgres has mature tooling, point-in-time recovery and replicas, but it takes more work to set up yourself.',
      'We scored both from 1 to 5 on five criteria for a typical side project. SQLite scored 5 for simplicity, 5 for cost and 5 for single-server speed, but 2 for concurrent writes and 3 for room to grow. Postgres scored 3, 4, 4, 5 and 5.',
      'Our recommendation: start with SQLite if your app runs on one server and you want the fewest moving parts. Choose Postgres from day one if you already know you need several writers, heavy analytics or extensions like pgvector. Moving from SQLite to Postgres later is very doable if you use an ORM or keep your SQL portable.',
    ],
    summary: `root = Card([hero, scores, compare, takeaways, quote, followUps], [{title: "SQLite or Postgres?", sourceName: "Stack & Scale", url: "https://stackandscale.example/databases/sqlite-or-postgres"}])
hero = SummaryHero("SQLite hay Postgres cho dự án cá nhân?", "Chạy trên một server và muốn đơn giản thì chọn SQLite. Cần nhiều tiến trình ghi cùng lúc hoặc extension như pgvector thì chọn Postgres ngay từ đầu.", null, 13)
scores = Comparison(["SQLite", "Postgres"], [s1, s2, s3, s4, s5], "Điểm trong bài (thang 1–5)", "SQLite thắng về độ đơn giản, chi phí và tốc độ trên một server. Postgres thắng về ghi đồng thời và khả năng mở rộng.")
s1 = CompareRow("Đơn giản", ["5", "3"], "SQLite")
s2 = CompareRow("Chi phí", ["5", "4"], "SQLite")
s3 = CompareRow("Tốc độ trên 1 server", ["5", "4"], "SQLite")
s4 = CompareRow("Ghi đồng thời", ["2", "5"], "Postgres")
s5 = CompareRow("Khả năng mở rộng", ["3", "5"], "Postgres")
compare = Comparison(["SQLite", "Postgres"], [r1, r2, r3, r4], "Khác nhau ở đâu")
r1 = CompareRow("Cách chạy", ["Thư viện, 1 file cạnh app", "Server riêng"])
r2 = CompareRow("Ghi cùng lúc", ["1 writer, bật WAL để reader không bị chặn", "Nhiều writer"], "Postgres")
r3 = CompareRow("Vận hành", ["Không cần gì thêm", "Dịch vụ managed có gói rẻ"], "SQLite")
r4 = CompareRow("Backup", ["Copy file, Litestream", "Point-in-time recovery, replica"])
takeaways = Takeaways([t1, t2])
t1 = Takeaway("Đổi sang Postgres sau vẫn ổn", "Nếu dùng ORM hoặc giữ SQL dễ chuyển")
t2 = Takeaway("Dùng SQLite thì bật WAL", "Reader không còn chặn writer")
quote = SourceQuote("start with SQLite if your app runs on one server and you want the fewest moving parts", "Khuyến nghị của tác giả")
followUps = FollowUpBlock([FollowUpItem("Litestream hoạt động thế nào?"), FollowUpItem("Dấu hiệu nào cho thấy nên chuyển sang Postgres?")])`,
  },

  docker: {
    site: 'Shipping Notes',
    url: 'shippingnotes.example/devops/faster-docker-builds',
    section: 'DevOps',
    title: 'Cut your Docker build time from 6 minutes to 50 seconds',
    dek: 'Most slow builds come from the same three mistakes. Fix the order of your Dockerfile, add a cache mount and use a multi-stage build.',
    byline: 'By Hana Kim · 10 min read',
    minutes: 10,
    mode: 'Hành động',
    paragraphs: [
      'Our Node.js API took 6 minutes and 10 seconds to build, even when we had changed a single line. After three changes to the Dockerfile, the same build takes about 50 seconds, and the final image shrank from 1.1 GB to 180 MB. None of the changes needed new tools.',
      'Docker builds an image layer by layer, and it reuses a cached layer only if that step and everything before it are unchanged. Our original Dockerfile copied the whole project first and then ran npm install. Every code change invalidated the copy step, so every build reinstalled all dependencies from scratch.',
      'The first fix is ordering. Copy package.json and the lockfile on their own, install dependencies, and only then copy the rest of the source. Now the expensive install layer is reused until the dependencies actually change. This change alone took our build from 6:10 to about 2 minutes.',
      'The second fix is a cache mount. With BuildKit, a RUN step can mount a persistent cache directory, so npm keeps its download cache between builds even when the install layer has to rerun. Adding a cache mount for /root/.npm brought us down to about 50 seconds.',
      'The third fix is a multi-stage build. The first stage installs everything and compiles TypeScript. The second stage starts from a slim base image and copies only the compiled output and production dependencies. Build tools, tests and source maps never reach production, which is why the image fell to 180 MB.',
      'Do not forget a .dockerignore file. Without one, node_modules, .git and local build output are sent to the builder on every build, which slows the first step and can quietly break caching.',
      'Here is the Dockerfile we ended up with:',
      'One caveat: CI runners often start with an empty cache. To keep these gains in CI, export the build cache to your registry or use your CI provider’s cache integration, otherwise every run starts cold.',
    ],
    code: DOCKERFILE,
    codeAfter: 6,
    summary: `root = Card([hero, numbers, bars, walk, todo, risks, followUps], [{title: "Cut your Docker build time", sourceName: "Shipping Notes", url: "https://shippingnotes.example/devops/faster-docker-builds"}])
hero = SummaryHero("Build Docker từ 6 phút xuống 50 giây", "Sắp xếp lại Dockerfile, thêm cache mount và chuyển sang multi-stage build. Không cần công cụ mới.", null, 10)
numbers = KeyNumbers([n1, n2])
n1 = KeyNumber("50 giây", "thời gian build, trước là 6:10")
n2 = KeyNumber("180 MB", "image, trước là 1,1 GB")
bars = BarList([b1, b2, b3], "Thời gian build sau từng bước")
b1 = BarItem("Ban đầu", 370, "6:10")
b2 = BarItem("Đổi thứ tự", 120, "~2:00")
b3 = BarItem("Cache mount", 50, "~0:50")
walk = CodeWalkthrough("${dockerfileLiteral}", [k1, k2, k3, k4], "dockerfile", "Dockerfile cuối cùng")
k1 = CodeNote("3-4", "Copy package.json và lockfile trước, cài dependency với cache mount")
k2 = CodeNote("5-6", "Sau đó mới copy code, build và bỏ devDependencies")
k3 = CodeNote("8", "Stage 2 bắt đầu từ image slim")
k4 = CodeNote("10-11", "Chỉ lấy code đã build và dependency cho production")
todo = Checklist(["Thêm .dockerignore (node_modules, .git, thư mục build)", "Bật BuildKit để dùng cache mount"], "Đừng quên")
risks = RiskList([r1], "Khi chạy trên CI")
r1 = Risk("medium", "CI runner thường bắt đầu với cache trống", "Export cache lên registry hoặc dùng cache của CI")
followUps = FollowUpBlock([FollowUpItem("Export cache lên registry thế nào?"), FollowUpItem("Áp dụng cho dự án Python được không?")])`,
  },

  microservices: {
    site: 'Code Review Weekly',
    url: 'codereviewweekly.example/opinion/microservices-mistake',
    section: 'Opinion',
    title: 'Opinion: Microservices were a mistake for most teams',
    dek: 'A decade after the hype, many companies are quietly merging their services back together. It is time to admit the monolith was fine all along.',
    byline: 'By Marcus Hale · 9 min read',
    minutes: 9,
    mode: 'Phản biện',
    paragraphs: [
      'Ten years ago, every engineering blog told the same story: break your monolith into microservices and your teams will move faster. I believed it. I spent four years at two companies doing exactly that. I now think it was the most expensive mistake of my career.',
      'The promise was independence. Each team would own a service, deploy on its own schedule and pick its own tools. In practice, our services were so tangled that a single feature touched five of them, and every release needed a meeting to agree on the order of deploys.',
      'The costs were everywhere. A function call became a network call that could time out. Debugging meant searching logs across a dozen services. We needed tracing, a service mesh, a platform team of six people and a cloud bill that grew faster than our traffic.',
      'I am not alone. Several well-known companies have published posts about moving services back into a single application and cutting their infrastructure costs. Every engineer I talk to has a similar story.',
      'The truth is that microservices solve an organisational problem, not a technical one. They make sense when you have hundreds of engineers who would otherwise step on each other. Most companies have thirty.',
      'Defenders say we simply did microservices badly, that our service boundaries were wrong. Maybe. But if a pattern only works when executed perfectly by experienced teams, it is a bad default for everyone else.',
      'A well-structured monolith, with clear modules and strict boundaries inside one codebase, gives you most of the benefits at a fraction of the cost. If a module truly needs to scale on its own later, you can extract it then, with real data to guide you.',
      'So here is my advice: start with a modular monolith. Split out a service only when you can name the specific problem it solves. “Everyone else is doing it” is not one of them.',
    ],
    summary: `root = Card([hero, claims, args, quote, check, followUps], [{title: "Microservices were a mistake", sourceName: "Code Review Weekly", url: "https://codereviewweekly.example/opinion/microservices-mistake"}])
hero = SummaryHero("Microservices có phải là sai lầm?", "Đây là bài ý kiến, dựa chủ yếu vào trải nghiệm của tác giả ở hai công ty. Lập luận hợp lý nhưng thiếu số liệu và nguồn dẫn.", null, 9)
claims = ClaimCheck([c1, c2, c3], "Các nhận định chính")
c1 = Claim("Microservices làm chi phí vận hành tăng vọt", "supported", "Ví dụ cụ thể: tracing, service mesh, team platform 6 người")
c2 = Claim("Nhiều công ty đang gộp service trở lại", "unsupported", "Nhắc tới các bài viết nhưng không nêu tên hay link")
c3 = Claim("Microservices chỉ hợp với tổ chức hàng trăm kỹ sư", "opinion", "Quan điểm của tác giả, không có dữ liệu")
args = ArgumentMap("Nên bắt đầu bằng modular monolith", [a1, a2, a3, a4], "Lập luận hai phía", "Phía ủng hộ có ví dụ thực tế. Phản biện “do chia service sai” được nhắc tới nhưng chưa được trả lời thỏa đáng.")
a1 = Argument("for", "Một tính năng phải sửa 5 service, release nào cũng phải họp", "Trải nghiệm của tác giả")
a2 = Argument("for", "Gọi hàm thành gọi mạng, debug khó, chi phí cloud tăng nhanh hơn traffic", "Trải nghiệm của tác giả")
a3 = Argument("for", "Tách module thành service sau, khi đã có số liệu thật", "Đề xuất của tác giả")
a4 = Argument("against", "Lỗi nằm ở cách chia ranh giới service, không phải ở microservices", "Tác giả chỉ đáp “Maybe”")
quote = SourceQuote("microservices solve an organisational problem, not a technical one", "Ý chính của bài")
check = Checklist(["Tìm các bài của những công ty đã gộp service mà tác giả nhắc tới", "So số kỹ sư với số service trong team của bạn"], "Nên kiểm chứng")
followUps = FollowUpBlock([FollowUpItem("Modular monolith là gì?"), FollowUpItem("Khi nào thì nên tách service?")])`,
  },
};
