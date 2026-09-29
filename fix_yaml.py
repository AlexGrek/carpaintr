import json
import glob
import re

mapping = {
    "F": ["sedan", "wagon"],
    "B": ["hatchback 3 doors", "hatchback 5 doors", "sedan", "wagon"],
    "C": ["coupe", "hatchback 3 doors", "hatchback 5 doors", "liftback", "sedan", "wagon"],
    "A": ["hatchback 3 doors", "hatchback 5 doors"],
    "SUV 3": ["suv 5 doors"],
    "SUV 1": ["suv 3 doors", "suv 5 doors"],
    "E": ["liftback", "sedan", "wagon"],
    "SUV 2": ["suv 3 doors", "suv 5 doors"],
    "D": ["coupe", "hatchback 3 doors", "hatchback 5 doors", "liftback", "sedan", "wagon"]
}

for file in glob.glob("common/cars/*.yaml"):
    with open(file, "r") as f:
        content = f.read()

    # Manual line by line processing
    lines = content.split('\n')
    out_lines = []
    current_class = None
    
    for line in lines:
        m_class = re.search(r"euro_class:\s*\"([^\"]+)\"", line)
        if m_class:
            current_class = m_class.group(1)
            out_lines.append(line)
            continue
            
        m_body = re.search(r"euro_body_types:\s*\[(.*?)\]", line)
        if m_body:
            if current_class and current_class in mapping:
                bodies = [b.strip().strip('"') for b in m_body.group(1).split(",") if b.strip()]
                valid_bodies = []
                for b in bodies:
                    if b in mapping[current_class]:
                        valid_bodies.append(b)
                if not valid_bodies:
                    valid_bodies = [mapping[current_class][0]]
                
                new_bodies_str = ", ".join([f'"{b}"' for b in valid_bodies])
                new_line = re.sub(r"euro_body_types:\s*\[.*?\]", f"euro_body_types: [{new_bodies_str}]", line)
                out_lines.append(new_line)
            else:
                out_lines.append(line)
            continue
            
        out_lines.append(line)
        
    with open(file, "w") as f:
        f.write("\n".join(out_lines))

print("Fixed bodies!")
