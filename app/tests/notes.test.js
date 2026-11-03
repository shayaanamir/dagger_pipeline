const request = require("supertest");
const app = require("../src/app");
const notesRouter = require("../src/routes/notes");

beforeEach(() => notesRouter.reset());

describe("Notes API", () => {
  test("GET /api/notes returns an empty list initially", async () => {
    const res = await request(app).get("/api/notes");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("POST /api/notes creates a note", async () => {
    const res = await request(app).post("/api/notes").send({ title: "Learn Dagger", body: "Pipelines as code" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, title: "Learn Dagger", body: "Pipelines as code" });
  });

  test("POST /api/notes rejects a missing title", async () => {
    const res = await request(app).post("/api/notes").send({ body: "no title" });
    expect(res.status).toBe(400);
  });

  test("GET /api/notes/:id returns 404 for unknown note", async () => {
    const res = await request(app).get("/api/notes/99");
    expect(res.status).toBe(404);
  });

  test("DELETE /api/notes/:id removes a note", async () => {
    await request(app).post("/api/notes").send({ title: "Temp" });
    const del = await request(app).delete("/api/notes/1");
    expect(del.status).toBe(204);
    const list = await request(app).get("/api/notes");
    expect(list.body).toHaveLength(0);
  });

  test("serves the web UI", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Dagger Notes");
  });
});
