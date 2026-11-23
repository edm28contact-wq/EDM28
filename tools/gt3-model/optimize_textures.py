import io,json,struct,hashlib,os,argparse
from PIL import Image
parser=argparse.ArgumentParser(description='Losslessly repack 8-bit glTF images and verify decoded RGBA values.')
parser.add_argument('--input',required=True)
parser.add_argument('--output-dir',required=True)
args=parser.parse_args()
ROOT=os.path.abspath(args.output_dir)
blob=open(args.input,'rb').read()
length=struct.unpack_from('<I',blob,12)[0]
gltf=json.loads(blob[20:20+length]);binary_start=20+length+8
os.makedirs(ROOT+'/optimized-textures',exist_ok=True)
records=[]
for index,image in enumerate(gltf.get('images',[])):
    view=gltf['bufferViews'][image['bufferView']];start=binary_start+view.get('byteOffset',0)
    data=blob[start:start+view['byteLength']]
    entry={'index':index,'name':image.get('name'),'sha256':hashlib.sha256(data).hexdigest(),'inputBytes':len(data),'changed':False}
    if data[:8]==b'\x89PNG\r\n\x1a\n' and data[24]==16:
        entry['reason']='16-bit PNG retained to preserve all sample values';records.append(entry);continue
    source=Image.open(io.BytesIO(data));rgba=source.convert('RGBA')
    output=io.BytesIO();options={'lossless':True,'exact':True,'method':6}
    if source.info.get('icc_profile'):options['icc_profile']=source.info['icc_profile']
    rgba.save(output,format='WEBP',**options);encoded=output.getvalue()
    decoded=Image.open(io.BytesIO(encoded)).convert('RGBA')
    if decoded.tobytes()!=rgba.tobytes():raise RuntimeError('Pixel values changed in '+str(image.get('name')))
    if len(encoded)<len(data)*.95:
        path=ROOT+'/optimized-textures/'+str(index)+'.webp';open(path,'wb').write(encoded)
        entry.update({'changed':True,'path':path,'mimeType':'image/webp','outputBytes':len(encoded),'rgbaPixelsIdentical':True,'dimensions':list(rgba.size)})
    else:entry['reason']='Less than 5 percent size reduction; original bytes retained'
    records.append(entry)
json.dump(records,open(ROOT+'/texture-replacements.json','w'),indent=2)
print(json.dumps({'converted':sum(r['changed'] for r in records),'before':sum(r['inputBytes'] for r in records),'after':sum(r.get('outputBytes',r['inputBytes']) for r in records),'largest':sorted(records,key=lambda r:r.get('outputBytes',r['inputBytes']),reverse=True)[:5]},indent=2))
