import { useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 抽屉高度百分比：默认 82% */
  heightPct?: number;
  title?: string;
  children: React.ReactNode;
  /** 底部安全区颜色 */
  bg?: string;
}

/**
 * 底部抽屉 —— 主场景上滑露出的一层
 *
 * 主场景不切页，只往上抽出一张纸。
 * 支持下滑关闭。
 */
export default function Drawer({ open, onClose, heightPct = 82, title, children, bg }: Props) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 遮罩：主场景下沉/模糊 */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ background: "rgba(41,39,37,.35)", backdropFilter: "blur(4px)" }}
            onClick={onClose}
          />

          {/* 抽屉 */}
          <motion.div
            className="fixed left-0 right-0 bottom-0 z-50 mx-auto max-w-md"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            style={{ height: `${heightPct}dvh` }}
          >
            <div
              className="flex h-full flex-col rounded-t-[28px]"
              style={{
                background: bg ?? "var(--surface-1)",
                boxShadow: "0 -12px 40px rgba(0,0,0,.12)",
              }}
            >
              {/* 把手 */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-10 rounded-full" style={{ background: "var(--ink-4)" }} />
              </div>

              {title && (
                <div className="px-6 pb-3 pt-1">
                  <h2 className="text-[13px]" style={{ color: "var(--ink-2)" }}>{title}</h2>
                </div>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
