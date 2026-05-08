# Contributing to OpenPMX

Thank you for your interest in contributing to OpenPMX! This project exists 
to democratize predictive maintenance for small and mid-sized manufacturers 
across the United States. Every contribution — code, documentation, bug 
reports, or feedback — directly helps the US manufacturing community.

---

## Who should contribute?

- Controls and automation engineers
- Manufacturing plant managers and technicians
- Data scientists and ML engineers
- Industrial IoT developers
- Anyone passionate about making US manufacturing more competitive

---

## Ways to contribute

### Report a bug
If you find a bug, please open a GitHub Issue with:
- A clear description of the problem
- Steps to reproduce it
- Your operating system and Python version
- Any error messages you see

### Suggest a feature
Have an idea to make OpenPMX better for manufacturers? Open a GitHub Issue 
with the label `enhancement` and describe:
- What problem it solves for manufacturers
- How you imagine it working
- Any relevant examples from your industry experience

### Contribute code
1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test everything works
5. Commit with a clear message: `git commit -m "Add: description of change"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Open a Pull Request on GitHub

### Improve documentation
Good documentation is as valuable as code. If something is unclear, 
confusing, or missing — fix it and submit a Pull Request.

### Share your experience
If you use OpenPMX in your facility, we'd love to hear about it:
- Open a GitHub Discussion
- Share what machine type you used it on
- Tell us what worked and what didn't
- Your real-world feedback directly shapes the roadmap

---

## Development setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### Local setup
```bash
# Clone the repo
git clone https://github.com/SahDhirendra/openpmx
cd openpmx

# Backend setup
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt

# Start backend
uvicorn app.main:app --reload

# Frontend setup (new terminal)
cd dashboard
npm install --legacy-peer-deps
npm run dev
```

Visit `http://localhost:5173` to see the platform running.

### Or use Docker
```bash
docker-compose up
```

---

## Code style guidelines

- **Python**: Follow PEP 8. Use descriptive variable names.
- **JavaScript/React**: Use functional components and hooks.
- **Commits**: Use clear, descriptive messages. Start with a verb: "Add", "Fix", "Update", "Remove".
- **Comments**: Explain *why*, not *what*. The code shows what — comments explain the reasoning.

---

## Priority areas for contribution

These are the features most needed by US manufacturers right now:

| Feature | Difficulty | Impact |
|---------|-----------|--------|
| CSV upload for custom machine data | Medium | High |
| Real-time WebSocket sensor updates | Medium | High |
| OPC-UA protocol adapter | Hard | Very High |
| Email alert notifications | Easy | High |
| Multi-machine dashboard | Medium | High |
| Mobile responsive design | Easy | Medium |
| Federated learning module | Hard | Very High |

---

## Questions?

Open a GitHub Discussion or reach out via LinkedIn:  
[linkedin.com/in/dhirendrasah](https://linkedin.com/in/dhirendrasah)

---

## Code of conduct

Be respectful, constructive, and welcoming. This project serves the 
manufacturing community — engineers, technicians, and plant managers 
of all backgrounds. Everyone's perspective is valuable.

---

*OpenPMX is built for the 300,000+ small and mid-sized manufacturers 
in the United States. Your contribution makes US manufacturing stronger.*