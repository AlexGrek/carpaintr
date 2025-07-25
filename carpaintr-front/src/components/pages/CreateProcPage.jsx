import TopBarUser from '../layout/TopBarUser';
import ProcessorGenerator from '../editor/ProcessGenerator';

const CreateProcPage = () => {
    return <div>
        <TopBarUser />
        <div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
            <ProcessorGenerator/>
        </div>
    </div>
}

export default CreateProcPage