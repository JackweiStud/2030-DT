/**
 * 横幅。相对 page，dock 外。
 */

type Props = {
  text: string | null;
};

export function Banner(props: Props) {
  if (!props.text) {
    return <div className="c4-banner" data-banner hidden />;
  }
  return (
    <div className="c4-banner" data-banner>
      {props.text}
    </div>
  );
}
