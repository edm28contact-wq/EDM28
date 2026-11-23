import bpy,json,os,re,hashlib,argparse,sys
from mathutils import Vector,Matrix

parser=argparse.ArgumentParser(description='Assemble supplied red GT3 appearance with original gray-source mechanics.')
parser.add_argument('--output-dir',required=True)
parser.add_argument('--red-source',required=True)
parser.add_argument('--front-brake-scale',required=True,type=float)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
OUT=os.path.abspath(args.output_dir)
RED=os.path.abspath(args.red_source)
GRAY=bpy.data.filepath
if not GRAY or not os.path.isfile(GRAY):raise RuntimeError('Open the supplied gray BLEND before running this script.')
if not os.path.isfile(RED):raise FileNotFoundError(RED)
if not 0<args.front_brake_scale<=1:raise ValueError('--front-brake-scale must be in (0, 1].')
os.makedirs(OUT,exist_ok=True)
gray_objects=list(bpy.data.objects)
gray_by_name={o.name:o for o in gray_objects}
gray_world={o.name:o.matrix_world.copy() for o in gray_objects}
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=RED)
red_objects=[o for o in bpy.data.objects if o not in before]
red_by_name={o.name:o for o in red_objects}
bpy.context.view_layer.update()

def actual_bounds(obj):
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    lower=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    upper=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return lower,upper
def center(obj):
    lo,hi=actual_bounds(obj);return (lo+hi)/2
def descendants(obj):
    result=[]
    for child in obj.children:result.append(child);result.extend(descendants(child))
    return result
def new_group(name,parent=None,**extras):
    obj=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(obj)
    if parent:obj.parent=parent
    for key,value in extras.items():obj[key]=value
    return obj
def components(obj):
    mesh=obj.data;parent=list(range(len(mesh.vertices)))
    def find(a):
        while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
        return a
    def union(a,b):
        a=find(a);b=find(b)
        if a!=b:parent[b]=a
    welded={}
    for v in mesh.vertices:
        key=tuple(round(c,4) for c in v.co)
        if key in welded:union(v.index,welded[key])
        else:welded[key]=v.index
    for edge in mesh.edges:union(*edge.vertices)
    groups={}
    for v in mesh.vertices:groups.setdefault(find(v.index),{'vertices':[],'polygons':[]})['vertices'].append(v.index)
    for p in mesh.polygons:groups[find(p.vertices[0])]['polygons'].append(p.index)
    result=[]
    for group in groups.values():
        points=[gray_world[obj.name]@mesh.vertices[i].co for i in group['vertices']]
        lower=Vector(tuple(min(p[i] for p in points) for i in range(3)))
        upper=Vector(tuple(max(p[i] for p in points) for i in range(3)))
        group.update({'center':(lower+upper)/2,'min':lower,'max':upper})
        result.append(group)
    return result

definitions=[
 ('av-gauche','LF','Object_4.003_Scene_-_Root.002_0','amdb11_brakedisc_FR.003',1,'F'),
 ('av-droite','RF','Object_4.002_Scene_-_Root.002_0','amdb11_brakedisc_FR.002',-1,'F'),
 ('ar-gauche','LR','Object_4.001_Scene_-_Root.002_0','amdb11_brakedisc_FR.001',1,'R'),
 ('ar-droite','RR','Object_4.004_Scene_-_Root.002_0','amdb11_brakedisc_FR.004',-1,'R')]
red_wheels={};wheel_ids={};red_discs={}
for wid,code,*_ in definitions:
    red_wheels[wid]=[o for o in descendants(red_by_name['WHEEL_'+code]) if o.type=='MESH']
    for obj in red_wheels[wid]:wheel_ids[obj]=wid
    tyre=next(o for o in red_wheels[wid] if 'Tyre' in o.name)
    red_discs[wid]=red_by_name['GEO_disc'+code]
floor_shift=.13-min(actual_bounds(o)[0].z for objects in red_wheels.values() for o in objects if 'Tyre' in o.name)
root=new_group('EDM28_GT3_Hybrid',sourceAppearance='Porsche_GT3RS_MOD.glb',sourceMechanics='Porsche 911 gt3 rs.blend')
root.location.z=floor_shift
body=new_group('carrosserie',root,partId='carrosserie',sourceAsset='red-weissach')
fixed=new_group('mecanique-fixe',root,partId='mecanique-fixe',sourceAsset='gray-gt3-rs')
part_groups={}
manifest={'version':1,'sources':{'appearance':RED,'mechanics':GRAY},'coordinateSystem':{'up':'+Y','front':'+Z','vehicleLeft':'+X','mirrored':False},
 'groundY':.13,'blenderVerticalTranslation':floor_shift,'wheels':{},'groups':[],'removedRedMeshes':[],
 'omittedParts':{'plaquettes':'No reliably identified independent friction-pad geometry in the supplied sources.','rearRotules':'No independently identified rear steering joint geometry.'},
 'textureChanges':[],'notes':['Appearance meshes, material colors, decals and UVs are retained from the red source.','Mechanical subsets contain only original polygons from the gray source; no replacement shapes are generated.','Mechanical units are uniformly scaled to the original red brake-disc diameter, then translated to the red wheel axes.','This cross-model alignment is a visual educational assembly, not manufacturer CAD.']}
def part_group(wid,part):
    key=(wid,part)
    if key not in part_groups:
        part_groups[key]=new_group(wid+'__'+part,root,wheelId=wid,partId=part,sourceAsset='red-weissach' if part=='roue' else 'gray-gt3-rs')
    return part_groups[key]
fit={};brake_fit={}
for wid,code,gray_tyre,gray_brake,side,axle in definitions:
    tyre=next(o for o in red_wheels[wid] if 'Tyre' in o.name)
    wheel_center=center(tyre)
    gray_disc=gray_by_name[gray_brake+'_amdb11_brake.002_0']
    gray_center=center(gray_disc)
    target_center=center(red_discs[wid])
    # Match both sides to the inboard rotor plane of the left source wheel.
    left_id='av-gauche' if axle=='F' else 'ar-gauche'
    target_center.x=side*abs(center(red_discs[left_id]).x)
    target_center.y=wheel_center.y;target_center.z=wheel_center.z
    glo,ghi=actual_bounds(gray_disc);rlo,rhi=actual_bounds(red_discs[wid])
    uniform_scale=max(rhi.y-rlo.y,rhi.z-rlo.z)/max(ghi.y-glo.y,ghi.z-glo.z)
    fit[wid]=Matrix.Translation(target_center)@Matrix.Scale(uniform_scale,4)@Matrix.Translation(-gray_center)
    brake_scale=args.front_brake_scale if axle=='F' else 1
    brake_fit[wid]=Matrix.Translation(target_center)@Matrix.Scale(brake_scale,4)@Matrix.Translation(-target_center)@fit[wid]
    wheel_final=[wheel_center.x,wheel_center.z+floor_shift,-wheel_center.y]
    manifest['wheels'][wid]={'sourceNode':'WHEEL_'+code,'side':side,'front':axle=='F','center':wheel_final,
      'centerBlenderOriginal':list(wheel_center),'mechanicsUniformScale':uniform_scale,'mechanicsTransformBlender':[list(row) for row in fit[wid]],'parts':[],
      'brakeUniformScale':uniform_scale*brake_scale,'brakeTransformBlender':[list(row) for row in brake_fit[wid]],
      'brakeClearanceAdjustment':{'factor':brake_scale,'centerBlenderOriginal':list(target_center),'axialTranslation':0,'scope':['disques','etrier'],'reason':'Front caliper-to-rim barrel clearance; uniform scaling preserves original brake geometry proportions and rotor-caliper relationship.' if axle=='F' else 'No clearance adjustment required.'}}

red_drop=set()
for _,code,*_ in definitions:
    for prefix in ['DISC_','SUSP_']:
        node=red_by_name[prefix+code]
        red_drop.update(descendants(node));red_drop.add(node)
for obj in red_objects:
    if obj.type!='MESH':continue
    if obj in red_drop:manifest['removedRedMeshes'].append(obj.name);continue
    world=obj.matrix_world.copy()
    group=part_group(wheel_ids[obj],'roue') if obj in wheel_ids else body
    obj.parent=group;obj.matrix_parent_inverse=Matrix.Identity(4);obj.matrix_basis=world
    obj['sourceAsset']='red-weissach';obj['sourceObject']=obj.name
    if obj in wheel_ids:obj['wheelId']=wheel_ids[obj];obj['partId']='roue'

component_cache={}
def get_components(obj):
    if obj.name not in component_cache:component_cache[obj.name]=components(obj)
    return component_cache[obj.name]
def copy_faces(source,polygon_indices,group,transform,part_id,wid=None):
    if not polygon_indices:return
    original=source.data
    polygons=[original.polygons[i] for i in sorted(polygon_indices)]
    used=sorted({i for p in polygons for i in p.vertices});mapping={old:new for new,old in enumerate(used)}
    world_transform=transform@gray_world[source.name]
    reverse_winding=world_transform.to_3x3().determinant()<0
    vertex_orders=[list(reversed(p.vertices)) if reverse_winding else list(p.vertices) for p in polygons]
    loop_orders=[list(reversed(p.loop_indices)) if reverse_winding else list(p.loop_indices) for p in polygons]
    coords=[transform@(gray_world[source.name]@original.vertices[i].co) for i in used]
    mesh=bpy.data.meshes.new(group.name+'__'+source.name)
    mesh.from_pydata(coords,[],[tuple(mapping[i] for i in vertices) for vertices in vertex_orders]);mesh.update()
    for material in original.materials:mesh.materials.append(material)
    normal_matrix=world_transform.to_3x3().inverted().transposed()
    normals=[]
    for index,p in enumerate(polygons):
        mesh.polygons[index].material_index=p.material_index;mesh.polygons[index].use_smooth=p.use_smooth
        for loop in loop_orders[index]:normals.append(tuple((normal_matrix@original.corner_normals[loop].vector).normalized()))
    mesh.normals_split_custom_set(normals)
    for layer in original.uv_layers:
        new_layer=mesh.uv_layers.new(name=layer.name)
        for new_poly,loops in zip(mesh.polygons,loop_orders):
            for ni,oi in zip(new_poly.loop_indices,loops):new_layer.data[ni].uv=layer.data[oi].uv
    obj=bpy.data.objects.new(group.name+'__'+source.name,mesh);bpy.context.scene.collection.objects.link(obj);obj.parent=group
    obj['partId']=part_id;obj['sourceAsset']='gray-gt3-rs';obj['sourceObject']=source.name
    if wid:obj['wheelId']=wid
    group_record=next((g for g in manifest['groups'] if g['name']==group.name),None)
    if not group_record:
        group_record={'name':group.name,'wheelId':wid,'partId':part_id,'sourceAsset':'gray-gt3-rs','sources':[]};manifest['groups'].append(group_record)
    group_record['sources'].append({'object':source.name,'originalPolygonIndices':[p.index for p in polygons],'vertices':len(used),'triangles':sum(len(p.vertices)-2 for p in polygons),'reflectedSourceWindingCorrected':reverse_winding})

for wid,code,gray_tyre,gray_brake,side,axle in definitions:
    disc=gray_by_name[gray_brake+'_amdb11_brake.002_0'];caliper=gray_by_name[gray_brake+'_amdb11_caliper.002_0']
    copy_faces(disc,list(range(len(disc.data.polygons))),part_group(wid,'disques'),brake_fit[wid],'disques',wid)
    copy_faces(caliper,list(range(len(caliper.data.polygons))),part_group(wid,'etrier'),brake_fit[wid],'etrier',wid)
    source_disc_center=center(disc)
    for suffix in ['amdb11_misc.002_0','amdb11_misc_chrome.002_0']:
        source=gray_by_name[gray_brake+'_'+suffix]
        buckets={'disques':[],'etrier':[]}
        for comp in get_components(source):
            radial=((comp['center'].y-source_disc_center.y)**2+(comp['center'].z-source_disc_center.z)**2)**.5
            part='disques' if radial<.17 else 'etrier';buckets[part].extend(comp['polygons'])
        for part,faces in buckets.items():copy_faces(source,faces,part_group(wid,part),brake_fit[wid],part,wid)
    for token,part in [('hub_'+axle,'moyeu'),('upperarm_'+axle,'triangles'),('lowerarm_'+axle,'triangles')]:
        source=gray_by_name['TwiXeR_992_'+token+'_TwiXeR_992.001_0']
        faces=[p for c in get_components(source) if c['center'].x*side>.05 for p in c['polygons']]
        copy_faces(source,faces,part_group(wid,part),fit[wid],part,wid)
    token='coilover_F' if axle=='F' else ('coilover_RL' if side>0 else 'coilover_RR')
    source=gray_by_name['TwiXeR_992_'+token+'_TwiXeR_992.001_0']
    faces=[p for c in get_components(source) if c['center'].x*side>.02 for p in c['polygons']]
    copy_faces(source,faces,part_group(wid,'amortisseur'),fit[wid],'amortisseur',wid)
    source=gray_by_name['TwiXeR_992_swaybar_'+axle+'_TwiXeR_992.001_0']
    faces=[p for c in get_components(source) if c['center'].x*side>.4 for p in c['polygons']]
    copy_faces(source,faces,part_group(wid,'stabilisation'),fit[wid],'stabilisation',wid)
    if axle=='F':
        source=gray_by_name['TwiXeR_992_tierod_F_TwiXeR_992.001_0']
        faces=[p for c in get_components(source) if c['center'].x*side>.5 for p in c['polygons']]
        copy_faces(source,faces,part_group(wid,'rotules'),fit[wid],'rotules',wid)

for axle in ['F','R']:
    left='av-gauche' if axle=='F' else 'ar-gauche';right='av-droite' if axle=='F' else 'ar-droite'
    common=fit[left].copy();common.translation=(fit[left].translation+fit[right].translation)/2
    for token,limit in [('swaybar_'+axle,.4)]+([('tierod_F',.5)] if axle=='F' else []):
        source=gray_by_name['TwiXeR_992_'+token+'_TwiXeR_992.001_0']
        faces=[p for c in get_components(source) if abs(c['center'].x)<limit for p in c['polygons']]
        copy_faces(source,faces,fixed,common,'mecanique-fixe')

for obj in red_objects:
    if obj.type!='MESH' or obj in red_drop:bpy.data.objects.remove(obj,do_unlink=True)
for obj in gray_objects:bpy.data.objects.remove(obj,do_unlink=True)
for image in bpy.data.images:
    if image.name=='T_Flakes_D2_Normal' and max(image.size)>512:
        old=list(image.size);image.scale(512,512);image.pack()
        manifest['textureChanges'].append({'name':image.name,'from':old,'to':[512,512],'precision':'16-bit PNG retained','purpose':'Only the repeating microflake normal-map resolution is reduced; base colors, decals, tyres, optics, carbon and all UVs are retained.'})
bpy.context.view_layer.update()
for (wid,part),group in part_groups.items():
    manifest['wheels'][wid]['parts'].append(part)
    if part=='roue':manifest['groups'].append({'name':group.name,'wheelId':wid,'partId':part,'sourceAsset':'red-weissach','sources':[{'object':o.name,'triangles':sum(len(p.vertices)-2 for p in o.data.polygons)} for o in group.children]})
all_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
lo=Vector((min(actual_bounds(o)[0][i] for o in all_meshes) for i in range(3)))
hi=Vector((max(actual_bounds(o)[1][i] for o in all_meshes) for i in range(3)))
manifest['statistics']={'meshCount':len(all_meshes),'triangleCount':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in all_meshes),'boundsBlender':{'min':list(lo),'max':list(hi)},'dimensionsBlender':list(hi-lo)}
for label,path in manifest['sources'].items():
    with open(path,'rb') as f:manifest.setdefault('sourceSha256',{})[label]=hashlib.file_digest(f,'sha256').hexdigest()
with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2,ensure_ascii=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'edm28-gt3-hybrid.blend'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'edm28-gt3-hybrid-uncompressed.glb'),export_format='GLB',export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',export_image_format='AUTO')
print('EDM28_HYBRID_RESULT',json.dumps({'statistics':manifest['statistics'],'wheels':manifest['wheels'],'textureChanges':manifest['textureChanges'],'removedRedMeshes':manifest['removedRedMeshes']}))
