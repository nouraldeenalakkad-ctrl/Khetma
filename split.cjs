const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function splitQuran() {
  console.log("جاري استكمال وتقسيم النصف الأول...");
  const file1Bytes = fs.readFileSync('quran1-323.pdf');
  const pdf1 = await PDFDocument.load(file1Bytes);
  const totalPages1 = pdf1.getPageCount();

  const ranges1 = [
    [1, 21], [22, 41], [42, 61], [62, 81], [82, 101],
    [102, 121], [122, 141], [142, 161], [162, 181], [182, 201],
    [202, 221], [222, 241], [242, 261], [262, 281], [282, 301], [302, 321]
  ];

  for (let i = 0; i < ranges1.length; i++) {
    const [start, end] = ranges1[i];
    const s = Math.max(0, start - 1);
    const e = Math.min(end, totalPages1);
    
    if (s < totalPages1) {
      const newPdf = await PDFDocument.create();
      const pageIndices = [];
      for (let p = s; p < e; p++) pageIndices.push(p);
      const copiedPages = await newPdf.copyPages(pdf1, pageIndices);
      copiedPages.forEach(cp => newPdf.addPage(cp));
      fs.writeFileSync(`juz${i + 1}.pdf`, await newPdf.save());
      console.log(`تم تجهيز juz${i + 1}.pdf`);
    }
  }

  console.log("جاري البدء في تقسيم النصف الثاني...");
  const file2Bytes = fs.readFileSync('quran324-607.pdf');
  const pdf2 = await PDFDocument.load(file2Bytes);
  const totalPages2 = pdf2.getPageCount();

  const ranges2 = [
    [322, 341], [342, 361], [362, 381], [382, 401], [402, 421],
    [422, 441], [442, 461], [462, 481], [482, 501], [502, 521],
    [522, 541], [542, 561], [562, 581], [582, 604]
  ];

  for (let i = 0; i < ranges2.length; i++) {
    const [start, end] = ranges2[i];
    const s = Math.max(0, start - 321);
    const e = Math.min(end - 321, totalPages2 - 1);

    if (s < totalPages2) {
      const newPdf = await PDFDocument.create();
      const pageIndices = [];
      for (let p = s; p <= e; p++) pageIndices.push(p);
      const copiedPages = await newPdf.copyPages(pdf2, pageIndices);
      copiedPages.forEach(cp => newPdf.addPage(cp));
      fs.writeFileSync(`juz${i + 17}.pdf`, await newPdf.save());
      console.log(`تم تجهيز juz${i + 17}.pdf`);
    }
  }

  console.log("تم تقسيم وحفظ جميع الأجزاء الثلاثين بنجاح!");
}

splitQuran();
