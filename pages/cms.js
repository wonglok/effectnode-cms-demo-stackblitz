import { CMSOnePage } from 'effectnode-cms/modern.js';
import { getCodes, firebaseConfig } from '../vfx';

export default function OnePageDemo() {
  return <CMSOnePage firebaseConfig={firebaseConfig} codes={getCodes()} />;
}