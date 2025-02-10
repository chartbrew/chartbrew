import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import PropTypes from "prop-types"
import {
  Card, CardBody, Textarea, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Link as LinkNext,
  Kbd, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button,
  ButtonGroup,
  CardFooter,
  Tooltip,
  Spacer,
  Link,
} from "@heroui/react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useDispatch, useSelector } from "react-redux"
import { LuEllipsisVertical, LuMonitorX, LuMonitor, LuTrash, LuPencil, LuLayoutDashboard, LuEye,
  LuHeading, LuBold, LuItalic, LuQuote, LuCode, LuImage, LuLink, LuListOrdered, LuList, LuSquareCheck
} from "react-icons/lu";
import { FaMarkdown } from "react-icons/fa6";
import { useParams } from "react-router";
import toast from "react-hot-toast";
import { debounce } from "lodash";

import { removeChart, updateChart } from "../../slices/chart"
import canAccess from "../../config/canAccess";
import { selectUser } from "../../slices/user";
import { selectTeam } from "../../slices/team";
import isMac from "../../modules/isMac";

function TextWidget({
  chart,
  onEditLayout,
  editingLayout,
  onCancelChanges,
  onSaveChanges,
  onEditContent,
  isPublic = false,
}) {
  const [content, setContent] = useState(chart.content || "");
  const [isEditing, setIsEditing] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const team = useSelector(selectTeam);
  const params = useParams();
  const textareaRef = useRef(null);

  useEffect(() => {
    setIsEditing(chart.staged)
  }, [chart])

  // Add a new handler for interactive elements
  const handleInteractiveMouseDown = (e) => {
    e.stopPropagation();
  };

  const components = {
    // code: ({ children }) => {
    //   const formattedText = String(children).replace(/^`|`$/g, ""); // Remove backticks

    //   return (
    //     <Code>
    //       {formattedText}
    //     </Code>
    //   );
    // },
    code: ({ children, className }) => {
      const formattedText = String(children).replace(/^`|`$/g, ""); // Strip backticks

      return className ? (
        // Block code (if it has a class, meaning it's a code block)
        <pre className="bg-content2 text-foreground p-2 rounded-md overflow-auto">
          <code className={className}>{formattedText}</code>
        </pre>
      ) : (
        // Inline code (if no class)
        <span className="bg-content2 text-foreground px-1 rounded">{formattedText}</span>
      );
    },
    li: ({ children, className }) => {
      // If this is a task list item, remove the bullet point and reduce padding
      if (className?.includes("task-list-item")) {
        return <li className={`${className} list-none -ml-6`}>{children}</li>;
      }
      return <li className={className}>{children}</li>;
    }
  };

  const _canAccess = (role) => {
    return canAccess(role, user.id, team.TeamRoles);
  }

  const insertMarkdown = (type, e) => {
    // Stop event propagation to prevent drag-and-drop
    e.preventDefault();
    e.stopPropagation();

    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;
    const selectedText = text.substring(start, end);

    let insertion = "";
    let newCursorPosition = start;

    switch (type) {
      case "heading":
        insertion = `### ${selectedText || "Heading"}`;
        newCursorPosition = start + 4; // Position cursor after `### `
        break;
      case "bold":
        insertion = `**${selectedText || "bold text"}**`;
        newCursorPosition = start + 2; // Position inside the `**`
        break;
      case "italic":
        insertion = `*${selectedText || "italic text"}*`;
        newCursorPosition = start + 1; // Position inside the `*`
        break;
      case "quote":
        insertion = `> ${selectedText || "quote"}`;
        newCursorPosition = start + 2; // Position after `> `
        break;
      case "code":
        insertion = `\`${selectedText || "code"}\``;
        newCursorPosition = start + 1; // Position inside the backticks
        break;
      case "image":
        insertion = "![alt text](image_url)";
        newCursorPosition = start + 2; // Move cursor inside `[alt text]`
        break;
      case "link":
        insertion = `[${selectedText || "link text"}](url)`;
        newCursorPosition = start + 1; // Move cursor inside `[ ]`
        break;
      case "numbered":
        insertion = `1. ${selectedText || "First item"}\n2. Second item`;
        newCursorPosition = start + 3; // Position after `1. `
        break;
      case "unordered":
        insertion = `- ${selectedText || "List item"}\n- Another item`;
        newCursorPosition = start + 2; // Position after `- `
        break;
      case "task":
        insertion = `- [ ] ${selectedText || "Task item"}\n- [ ] Another task`;
        newCursorPosition = start + 6; // Position inside `[ ]`
        break;
      default:
        break;
    }

    const newContent = text.substring(0, start) + insertion + text.substring(end);
    _onEditContent(newContent);

    // Set cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
  };

  const debouncedEditContent = useCallback(
    debounce((content) => {
      if (chart.staged) {
        onEditContent(content);
      }
    }, 300),
    [chart.staged, onEditContent]
  );

  const _onEditContent = (content) => {
    setContent(content);
    debouncedEditContent(content);
  }

  const _onChangeReport = () => {
    setChartLoading(true);

    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { onReport: !chart.onReport },
    }))
      .then((response) => {
        if (response?.error) {
          toast.error("Error updating the widget");
        }

        setChartLoading(false);
      })
      .catch(() => {
        toast.error("Error updating the widget");
        setChartLoading(false);
      });
  };

  const _onDeleteChartConfirmation = () => {
    setDeleteModal(true);
  }

  const _onDeleteChart = () => {
    setDeleteModal(false);
    setChartLoading(true);
    dispatch(removeChart({
      project_id: params.projectId,
      chart_id: chart.id,
    }))
      .then((response) => {
        if (response?.error) {
          toast.error("Error deleting the widget");
        }

        setChartLoading(false);
      })
      .catch(() => {
        toast.error("Error deleting the widget");
        setChartLoading(false);
      });
  }

  const _onSaveContent = () => {
    setChartLoading(true);

    if (chart.staged) {
      return onSaveChanges();
    }

    dispatch(updateChart({
      project_id: params.projectId,
      chart_id: chart.id,
      data: { content },
    }))
      .then((response) => {
        if (response?.error) {
          toast.error("Error updating the widget");
        }

        setChartLoading(false);
      })
      .catch(() => {
        toast.error("Error updating the widget");
        setChartLoading(false);
      });
  }

  const _onCancelChanges = () => {
    setIsEditing(false);
    _onEditContent(chart.content);
    if (chart.staged) {
      onCancelChanges();
    }
  };

  const MemoizedMarkdown = useMemo(() => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  ), [content]);

  return (
    <motion.div
      animate={{ opacity: [0, 1] }}
      transition={{ duration: 0.7 }}
      className="w-full h-full"
    >
      {chart && (
        <Card
          shadow="none"
          className={"h-full bg-content1 border-solid border-1 border-divider"}
        >
          {isEditing && (
            <>
              <CardBody>
                {!isPreview && (
                  <>
                    <div 
                      className="flex gap-1 flex-wrap"
                      onMouseDown={handleInteractiveMouseDown}
                    >
                      <Tooltip content="Add heading">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("heading", e)}>
                          <LuHeading size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add bold text">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("bold", e)}>
                          <LuBold size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add italic text">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("italic", e)}>
                          <LuItalic size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add quote">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("quote", e)}>
                          <LuQuote size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add code">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("code", e)}>
                          <LuCode size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add image">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("image", e)}>
                          <LuImage size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add link">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("link", e)}>
                          <LuLink size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add numbered list">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("numbered", e)}>
                          <LuListOrdered size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add bullet list">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("unordered", e)}>
                          <LuList size={16} />
                        </div>
                      </Tooltip>
                      <Tooltip content="Add task list">
                        <div className="p-1 rounded-md hover:bg-content2 cursor-pointer" onClick={(e) => insertMarkdown("task", e)}>
                          <LuSquareCheck size={16} />
                        </div>
                      </Tooltip>
                    </div>
                    <Spacer y={2} />
                    <div className="flex flex-col h-full">
                      <Textarea
                        value={content}
                        onChange={(e) => _onEditContent(e.target.value)}
                        placeholder="Enter markdown text here..."
                        className="!h-full font-mono"
                        variant="bordered"
                        onMouseDown={handleInteractiveMouseDown}
                        ref={textareaRef}
                        fullWidth
                        endContent={(
                          <Button
                            variant="flat"
                            size="sm"
                            onPress={() => setIsPreview(true)}
                            isLoading={chartLoading}
                            isIconOnly
                            onMouseDown={handleInteractiveMouseDown}
                          >
                            <LuEye />
                          </Button>
                        )}
                        description={
                          <Link className="flex flex-row gap-1 items-center" href="https://www.markdownguide.org/basic-syntax/" target="_blank">
                            <FaMarkdown size={18} />
                            <span className="text-xs text-gray-500">Markdown is supported</span>
                          </Link>
                        }
                      />
                    </div>
                  </>
                )}
                {isPreview && (
                  <div className="relative prose prose-xs md:prose-sm dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-h5:text-sm prose-h6:text-xs prose-a:text-primary hover:prose-a:text-primary-400 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-2 prose-blockquote:italic prose-strong:font-bold prose-em:italic prose-pre:bg-content2 prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded prose-img:rounded prose-img:mx-auto max-w-none p-1 leading-tight [&>p]:mb-4 [&>*]:my-2">
                    <Button
                      isIconOnly
                      size="sm" 
                      variant="flat"
                      className="absolute top-1 right-1"
                      onPress={() => setIsPreview(false)}
                    >
                      <LuPencil />
                    </Button>
                    {MemoizedMarkdown}
                  </div>
                )}
              </CardBody>
              <CardFooter>
                <ButtonGroup fullWidth size="sm">
                  <Button
                    variant="flat"
                    onPress={_onCancelChanges}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="flat"
                    onPress={_onSaveContent}
                    isLoading={chartLoading}
                    color="primary"
                  >
                    Save
                  </Button>
                </ButtonGroup>
              </CardFooter>
            </>
          )}
          {!isEditing && (
            <CardBody className="relative">
              {!isPublic && (
                <div className={`absolute top-4 right-2 ${_canAccess("projectEditor") ? "" : "hidden"}`}>
                  <Dropdown aria-label="Select a widget option">
                    <DropdownTrigger>
                      <LinkNext className="text-gray-500 cursor-pointer chart-settings-tutorial">
                        <LuEllipsisVertical />
                      </LinkNext>
                    </DropdownTrigger>
                    <DropdownMenu>
                      {_canAccess("projectEditor") && (
                        <DropdownItem
                          startContent={<LuPencil />}
                          onPress={() => setIsEditing(true)}
                          textValue="Edit content"
                        >
                          Edit content
                        </DropdownItem>
                      )}
                      {_canAccess("projectEditor") && (
                        <DropdownItem
                          startContent={<LuLayoutDashboard className={editingLayout ? "text-primary" : ""} />}
                          onPress={onEditLayout}
                          showDivider
                          textValue={editingLayout ? "Complete layout" : "Edit layout"}
                          endContent={<Kbd keys={[isMac ? "command" : "ctrl", "e"]}>E</Kbd>}
                        >
                          <span className={editingLayout ? "text-primary" : ""}>
                            {editingLayout ? "Complete layout" : "Edit layout"}
                          </span>
                        </DropdownItem>
                      )}
                      {!chart.draft && _canAccess("projectEditor") && (
                        <DropdownItem
                          startContent={chart.onReport ? <LuMonitorX /> : <LuMonitor />}
                          onPress={_onChangeReport}
                          textValue={chart.onReport ? "Remove from report" : "Add to report"}
                          showDivider
                        >
                          {chart.onReport ? "Remove from report" : "Add to report"}
                        </DropdownItem>
                      )}
                      {_canAccess("projectEditor") && (
                        <DropdownItem
                          startContent={<LuTrash />}
                          color="danger"
                          onPress={_onDeleteChartConfirmation}
                          textValue="Delete widget"
                        >
                          Delete widget
                        </DropdownItem>
                      )}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              )}

              <div className="prose prose-xs md:prose-sm dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-h4:text-base prose-h5:text-sm prose-h6:text-xs prose-a:text-primary hover:prose-a:text-primary-400 prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-2 prose-blockquote:italic prose-strong:font-bold prose-em:italic prose-pre:bg-content2 prose-pre:text-foreground prose-pre:p-2 prose-pre:rounded prose-img:rounded prose-img:mx-auto max-w-none p-1 leading-tight [&>p]:mb-4 [&>*]:my-2">
                {MemoizedMarkdown}
              </div>
            </CardBody>
          )}
        </Card>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <Modal isOpen={deleteModal} onClose={() => setDeleteModal(false)} backdrop="blur">
        <ModalContent>
          <ModalHeader>
            <div className="font-bold">Remove the widget?</div>
          </ModalHeader>
          <ModalBody>
            <div className="text-sm">
              {"The widget will be removed from the dashboard and you won't be able to see it anymore."}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDeleteModal(false)}
              auto
            >
              Go back
            </Button>
            <Button
              color="danger"
              endContent={<LuTrash />}
              onPress={_onDeleteChart}
              isLoading={chartLoading}
            >
              Remove completely
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}

TextWidget.propTypes = {
  chart: PropTypes.object.isRequired,
  onEditLayout: PropTypes.func.isRequired,
  editingLayout: PropTypes.bool.isRequired,
  onCancelChanges: PropTypes.func.isRequired,
  onSaveChanges: PropTypes.func.isRequired,
  onEditContent: PropTypes.func.isRequired,
  isPublic: PropTypes.bool,
};

export default TextWidget
