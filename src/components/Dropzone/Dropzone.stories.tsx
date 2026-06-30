import type { Story } from "@ladle/react";
import { useState } from "react";
import { Dropzone, type DropzoneProps } from "./Dropzone";

export const Playground: Story<DropzoneProps> = (args) => {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div style={{ maxWidth: "28rem" }}>
      <Dropzone {...args} files={files} onFilesChange={setFiles} />
    </div>
  );
};
Playground.args = {
  multiple: true,
  disabled: false,
  showList: true,
  label: "Drop files here",
  description: "or click to browse",
  accept: "",
};
Playground.argTypes = {
  multiple: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
  showList: { control: { type: "boolean" } },
};

export const Default: Story = () => {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div style={{ maxWidth: "28rem" }}>
      <Dropzone files={files} onFilesChange={setFiles} />
    </div>
  );
};

// Single file: a new pick replaces the previous one.
export const SingleFile: Story = () => {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div style={{ maxWidth: "28rem" }}>
      <Dropzone
        multiple={false}
        accept="image/*"
        files={files}
        onFilesChange={setFiles}
        label="Drop an image"
        description="PNG, JPG, GIF — or click to browse"
      />
    </div>
  );
};

// The `fileStatus` slot hosts consumer-owned upload state (here a faux progress).
export const WithStatus: Story = () => {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div style={{ maxWidth: "28rem" }}>
      <Dropzone
        files={files}
        onFilesChange={setFiles}
        fileStatus={(_file, i) => (
          <span style={{ fontSize: "0.75rem", color: "var(--sf-color-muted)" }}>
            {i === 0 ? "uploading…" : "queued"}
          </span>
        )}
      />
    </div>
  );
};

export const Disabled: Story = () => (
  <div style={{ maxWidth: "28rem" }}>
    <Dropzone disabled defaultFiles={[]} />
  </div>
);
