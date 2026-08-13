/* =========================================================
 * 上房方征招聘站 · 前端逻辑
 * 依赖：js/jobs.js 中的 JOBS 数组
 * 投递方式：Formsubmit.co（免费、支持简历附件、直接发到指定邮箱，无需后端）
 *   接收邮箱地址见 RECEIVE_EMAIL；首次使用需点击该邮箱收到的「激活邮件」
 * ========================================================= */
(function () {
  "use strict";

  // 简历接收邮箱（投递表单会直接发到此邮箱，含简历附件）
  var RECEIVE_EMAIL = "leixm@startmarch.com.cn";
  // 注意：Formsubmit 的 /ajax/ 接口不会附带文件附件，必须使用标准接口（无 /ajax/ 前缀），
  //       并以原生表单 POST（multipart）提交，简历才能作为邮件附件送达。
  var FORMSUBMIT_TO = "https://formsubmit.co/" + RECEIVE_EMAIL;

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("year").textContent = new Date().getFullYear();
    renderJobs();
    fillPositions();
    bindForm();
  });

  /* ---------- 渲染职位卡片 ---------- */
  function renderJobs() {
    var list = document.getElementById("job-list");
    if (!list || !Array.isArray(JOBS)) return;
    list.innerHTML = "";
    JOBS.forEach(function (job) {
      var card = document.createElement("div");
      card.className = "job-card";

      var duties = (job.duties || []).map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("");
      var reqs = (job.requires || []).map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("");

      card.innerHTML =
        '<div class="job-head" role="button" tabindex="0">' +
          '<div class="job-main">' +
            '<div class="job-title">' + esc(job.title) + '</div>' +
            '<div class="job-meta">' + esc(job.dept) + ' · ' + esc(job.location) + '</div>' +
          '</div>' +
          '<div style="text-align:right">' +
            '<div class="job-salary">' + esc(job.salary) + '</div>' +
            '<span class="job-arrow">▾</span>' +
          '</div>' +
        '</div>' +
        '<div class="job-detail">' +
          '<h4>岗位职责</h4><ul>' + duties + '</ul>' +
          '<h4>任职要求</h4><ul>' + reqs + '</ul>' +
          '<a class="job-apply" href="#apply" data-pos="' + esc(job.title) + '">投递该岗位</a>' +
        '</div>';

      var head = card.querySelector(".job-head");
      function toggle() { card.classList.toggle("open"); }
      head.addEventListener("click", toggle);
      head.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });

      // "投递该岗位"：展开后点击，把岗位填入表单并滚动
      card.querySelector(".job-apply").addEventListener("click", function () {
        var sel = document.getElementById("position");
        if (sel) sel.value = job.title;
        clearError("position");
      });

      list.appendChild(card);
    });
  }

  /* ---------- 填充应聘岗位下拉 ---------- */
  function fillPositions() {
    var sel = document.getElementById("position");
    if (!sel || !Array.isArray(JOBS)) return;
    JOBS.forEach(function (job) {
      var opt = document.createElement("option");
      opt.value = job.title;
      opt.textContent = job.title + "（" + job.dept + "）";
      sel.appendChild(opt);
    });
  }

  /* ---------- 表单校验与提交 ---------- */
  function bindForm() {
    var form = document.getElementById("apply-form");
    var msg = document.getElementById("form-msg");
    var btn = document.getElementById("submit-btn");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.textContent = "";
      msg.className = "form-msg";

      var data = {
        name: val("name"),
        gender: val("gender"),
        birth: val("birth"),
        phone: val("phone"),
        email: val("email"),
        position: val("position"),
        education: val("education"),
        city: val("city"),
        expected_salary: val("expected_salary"),
        experience: val("experience"),
        intro: val("intro")
      };

      var ok = true;
      ok = check("name", data.name.trim().length >= 1, "请填写姓名") && ok;
      ok = check("gender", !!data.gender, "请选择性别") && ok;
      ok = check("birth", !!data.birth, "请选择出生年月") && ok;
      ok = check("phone", /^1[3-9]\d{9}$/.test(data.phone.trim()), "请填写正确的 11 位手机号") && ok;
      ok = check("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()), "请填写正确的邮箱") && ok;
      ok = check("position", !!data.position, "请选择应聘岗位") && ok;
      ok = check("education", !!data.education, "请选择最高学历") && ok;
      ok = check("experience", data.experience.trim().length >= 2, "请简述工作经历") && ok;

      var fileInput = document.getElementById("resume");
      var file = fileInput && fileInput.files && fileInput.files[0];
      var allowed = ["pdf", "doc", "docx"];
      if (!file) {
        ok = check("resume", false, "请上传简历") && ok;
      } else {
        var ext = file.name.split(".").pop().toLowerCase();
        if (allowed.indexOf(ext) === -1) {
          ok = check("resume", false, "仅支持 PDF / Word 格式") && ok;
        } else if (file.size > 10 * 1024 * 1024) {
          ok = check("resume", false, "文件不能超过 10MB") && ok;
        } else {
          clearError("resume");
        }
      }

      if (!ok) {
        msg.textContent = "请检查并完善标红的必填项。";
        msg.className = "form-msg bad";
        return;
      }

      // 动态设置邮件主题（含姓名）
      var subj = form.querySelector('input[name="_subject"]');
      if (subj) subj.value = "上房方征招聘简历投递 · " + data.name;

      // 以原生表单 POST 提交到 Formsubmit「标准接口」（非 /ajax/），
      // 通过隐藏 iframe 承接响应：既避免整页跳转，又能正常收取简历附件。
      btn.disabled = true;
      btn.textContent = "提交中…";
      pendingSubmit = true;
      if (submitTimer) clearTimeout(submitTimer);
      submitTimer = setTimeout(function () {
        if (!pendingSubmit) return;
        pendingSubmit = false;
        btn.disabled = false;
        btn.textContent = "提交投递";
        msg.textContent = "提交超时，请检查网络后重试，或稍后查收邮箱确认是否送达。";
        msg.className = "form-msg bad";
      }, 20000);
      form.action = FORMSUBMIT_TO;
      form.method = "POST";
      form.submit();
    });

    // 隐藏 iframe 收到 Formsubmit 响应后，视为投递成功（跨域无法读取内容，故以 load 事件判断）
    var iframe = document.getElementById("_sf_iframe");
    var pendingSubmit = false;
    var submitTimer = null;
    if (iframe) {
      iframe.addEventListener("load", function () {
        if (!pendingSubmit) return;
        pendingSubmit = false;
        if (submitTimer) clearTimeout(submitTimer);
        btn.disabled = false;
        btn.textContent = "提交投递";
        form.classList.add("hidden");
        document.getElementById("success-card").classList.remove("hidden");
        document.getElementById("apply").scrollIntoView({ behavior: "smooth" });
      });
    }

    // "再投一份"
    var again = document.getElementById("again-btn");
    if (again) {
      again.addEventListener("click", function () {
        document.getElementById("apply-form").reset();
        document.getElementById("apply-form").classList.remove("hidden");
        document.getElementById("success-card").classList.add("hidden");
        ["name", "gender", "birth", "phone", "email", "position", "education", "experience", "resume"]
          .forEach(clearError);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ---------- 工具函数 ---------- */
  function val(id) { return (document.getElementById(id) || {}).value || ""; }
  function check(field, cond, text) {
    var small = document.querySelector('.err[data-for="' + field + '"]');
    var wrap = small ? small.closest(".field") : null;
    if (cond) {
      if (small) small.textContent = "";
      if (wrap) wrap.classList.remove("invalid");
      return true;
    } else {
      if (small) small.textContent = text;
      if (wrap) wrap.classList.add("invalid");
      return false;
    }
  }
  function clearError(field) { check(field, true, ""); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
