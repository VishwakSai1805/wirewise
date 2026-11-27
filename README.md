# Wirewise

**Computer networks, packet by packet.** A free, interactive computer networks course that runs entirely in the browser.

- **Animated protocol lessons**: ARP, DHCP, ICMP (ping and traceroute), TCP, DNS and HTTP. Each lesson has a network view, a sequence diagram, a packet list and a byte-level inspector.
- **Real packets**: every frame is generated with correct lengths and checksums, so the hex dump is what a capture tool would show.
- **Syllabus labs**: encapsulation, line coding, CRC / Hamming / Internet checksum, sliding window protocols (Stop-and-Wait, Go-Back-N, Selective Repeat), subnetting with practice questions, Dijkstra and distance-vector routing, and TCP congestion control (Tahoe vs Reno).
- **Practice**: a quiz and a “rebuild the exchange” exam for every lesson.
- **Free and private**: no accounts, ads or tracking. Progress is stored in the browser and can be exported to a file.
- **Light**: about 45 KB of JavaScript on first load; each lab loads only when opened.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev      # start a local server with hot reload
npm test         # run the unit tests
npm run build    # production build in dist/
```

## Publish on GitHub Pages

1. Push this repository to GitHub (it must be public on a free account).
2. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Every push to `main` now runs the tests, builds the site and deploys it to `https://<your-username>.github.io/<repo-name>/`.

Set your repository URL in `src/site.ts` to show a GitHub link in the header.

## Project structure

```
src/
  packets/        packet encoders (Ethernet, ARP, IPv4, UDP, TCP, ICMP, DNS, DHCP, HTTP)
  course/
    lessons/      one file per protocol lesson
    syllabus.ts   units and the order of lessons and labs
    glossary.ts   glossary terms
  components/     lesson player, network and sequence views, inspector, quiz
  labs/           interactive labs; algo/ holds the tested algorithms
  pages/          home, lesson, exam, lab and glossary pages
  styles/         CSS (light and dark themes)
```

## Adding a lesson

1. Copy one of the files in `src/course/lessons/` (for example `arp.ts`).
2. Describe the devices and links, then the packets. Each packet has a `build()` function that uses the encoders in `src/packets/layers.ts`.
3. Write the steps (each lists the packet ids it shows), the takeaways and the quiz.
4. Register the lesson in `src/course/lessons/index.ts` and place it in a unit in `src/course/syllabus.ts`.
5. Run `npm test`: the tests check every lesson packet’s checksums and that steps and paths reference real packets and devices.

## Notes on accuracy

IP addresses come from private and documentation ranges (RFC 1918, RFC 5737) and MAC addresses from the documentation range (RFC 7042). Root and .com server addresses are the real public ones. Where textbooks disagree on conventions (NRZ-L levels, Manchester polarity, ACK numbering), the lab states which one it uses.
