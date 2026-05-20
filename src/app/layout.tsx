import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '人话.py - 把你的中文，翻译成 Python 话',
  description:
    '输入一句人话，生成一段程序员看了会沉默的 Python。把中文自然语言翻译成 Python 风格代码的趣味 AI 工具。',
  keywords: ['人话.py', '中文转Python', 'AI翻译', '趣味编程', '代码生成'],
  authors: [{ name: '人话.py' }],
  openGraph: {
    title: '人话.py - 把你的中文，翻译成 Python 话',
    description: '输入一句人话，生成一段程序员看了会沉默的 Python。',
    locale: 'zh_CN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
