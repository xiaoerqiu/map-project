const xlsx = require('xlsx');

// 创建一个新的工作簿
const workbook = xlsx.utils.book_new();

// 准备数据，包含表头和示例数据
const data = [
  {
    address: '北京市海淀区中关村南大街5号',
    name: '某科技公司',
    type: '企业',
    contact: '张先生',
    phone: '010-12345678'
  },
  {
    address: '上海市浦东新区陆家嘴环路1000号',
    name: '某金融中心',
    type: '地标',
    contact: '李女士',
    phone: '021-87654321'
  }
];

// 将数据转换为工作表
const ws = xlsx.utils.json_to_sheet(data);

// 将工作表添加到工作簿
xlsx.utils.book_append_sheet(workbook, ws, '地址数据');

// 写入文件
xlsx.writeFile(workbook, 'public/examples/sample.xlsx');

console.log('示例Excel文件已创建成功！');