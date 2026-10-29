import {test,expect} from "@playwright/test";
test("health, protected routes and login layout",async({page,request})=>{
 const health=await request.get("/api/health");expect(health.status()).toBe(200);expect(await health.json()).toEqual({status:"ok"});
 await page.goto("/dashboard");await expect(page).toHaveURL(/\/login/);await expect(page.getByLabel("Email")).toBeVisible();await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
 for(const endpoint of ["/api/cvs","/api/applications","/api/tailoring","/api/learning","/api/github"]){expect((await request.get(endpoint)).status()).toBe(401);}
 for(const endpoint of ["/api/agent","/api/match","/api/analyze-job","/api/company-research"]){expect((await request.post(endpoint,{data:{}})).status()).toBe(401);}
});
test("signup navigation and hostile origin are handled safely",async({page,request})=>{
 await page.goto("/signup");await expect(page.getByLabel("Email")).toBeVisible();await expect(page.getByLabel("Password",{exact:true})).toBeVisible();
 expect((await request.post("/api/applications",{headers:{Origin:"https://attacker.invalid"},data:{}})).status()).toBe(403);
 const response=await request.get("/login");expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});
// Optional dedicated test account only. Never silently reuse a personal browser session.
test("authenticated tracker create, move, edit, refresh and delete",async({page})=>{
 test.skip(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD,"Dedicated confirmed test account not configured");
 const role=`E2E Intern ${Date.now()}`;
 await page.goto("/login");await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);await page.getByLabel("Password",{exact:true}).fill(process.env.E2E_PASSWORD!);await page.getByRole("button",{name:"Log in",exact:true}).click();await expect(page).toHaveURL(/\/profile/);
 await page.goto("/applications");await page.getByText("Add application manually",{exact:true}).click();await page.getByLabel("Company",{exact:true}).fill("Synthetic E2E Company");await page.getByLabel("Job title",{exact:true}).fill(role);await page.getByRole("button",{name:"Save application",exact:true}).click();
 const card=page.locator("article").filter({has:page.getByRole("heading",{name:role,exact:true})});
 try{await expect(card).toBeVisible();await card.getByLabel(`Stage for ${role}`).selectOption("Interview");await page.reload();await expect(card.getByLabel(`Stage for ${role}`)).toHaveValue("Interview");await card.getByRole("button",{name:"Edit",exact:true}).click();await page.getByLabel("Notes",{exact:true}).fill("Synthetic follow-up note");await page.getByRole("button",{name:"Save application",exact:true}).click();await page.getByLabel("Search",{exact:true}).fill(role);await expect(card).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();}
 finally{page.on("dialog",d=>d.accept());if(await card.count())await card.getByRole("button",{name:"Delete",exact:true}).click();}
});
import {samplePdf} from "../fixtures/pdf";
test("authenticated CV upload, profile, private download and dashboard",async({page})=>{
 test.skip(!process.env.E2E_EMAIL||!process.env.E2E_PASSWORD,"Dedicated confirmed test account not configured");
 await page.goto("/login");await page.getByLabel("Email").fill(process.env.E2E_EMAIL!);await page.getByLabel("Password",{exact:true}).fill(process.env.E2E_PASSWORD!);await page.getByRole("button",{name:"Log in",exact:true}).click();await expect(page).toHaveURL(/\/profile/);
 const filename=`synthetic-e2e-${Date.now()}.pdf`;
 const uploaded=await page.request.post("/api/cvs",{multipart:{file:{name:filename,mimeType:"application/pdf",buffer:samplePdf()}}});expect(uploaded.status()).toBe(201);const {cv}=await uploaded.json();
 try{await page.reload();await expect(page.getByText(filename,{exact:false}).first()).toBeVisible();const downloaded=await page.request.get(`/api/cvs/download?cv_id=${cv.id}`);expect(downloaded.status()).toBe(200);expect((await downloaded.body()).subarray(0,5).toString()).toBe("%PDF-");await page.goto("/dashboard");await expect(page.getByRole("heading",{name:"Career readiness",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();}
 finally{expect((await page.request.post("/api/cvs/delete",{data:{id:cv.id}})).status()).toBe(200);}
});
